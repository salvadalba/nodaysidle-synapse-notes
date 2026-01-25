import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../contexts/WorkspaceContext'
import type { Note } from '../lib/database.types'

interface GraphNode extends THREE.Mesh {
  userData: {
    noteId: string
    title: string
    createdAt: Date
    connectionCount: number
  }
}

interface GraphEdge extends THREE.Line {
  userData: {
    sourceId: string
    targetId: string
  }
}

export default function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster())
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2())
  const nodesRef = useRef<GraphNode[]>([])
  const edgesRef = useRef<GraphEdge[]>([])
  const hoveredNodeRef = useRef<GraphNode | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const tooltipTimeoutRef = useRef<number | null>(null)

  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [noteCount, setNoteCount] = useState(0)

  const handleResize = useCallback(() => {
    if (!cameraRef.current || !rendererRef.current || !containerRef.current) return

    cameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight
    cameraRef.current.updateProjectionMatrix()
    rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
  }, [])

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current)
    const intersects = raycasterRef.current.intersectObjects(nodesRef.current)

    if (intersects.length > 0) {
      const node = intersects[0].object as GraphNode

      if (hoveredNodeRef.current !== node) {
        // Reset previous hovered node
        if (hoveredNodeRef.current) {
          const material = hoveredNodeRef.current.material as THREE.MeshStandardMaterial
          material.emissiveIntensity = 0.4
        }

        // Highlight new hovered node
        hoveredNodeRef.current = node
        const material = node.material as THREE.MeshStandardMaterial
        material.emissiveIntensity = 0.8

        // Show tooltip
        if (tooltipRef.current) {
          tooltipRef.current.textContent = node.userData.title
          tooltipRef.current.style.display = 'block'
          tooltipRef.current.style.left = `${event.clientX + 10}px`
          tooltipRef.current.style.top = `${event.clientY + 10}px`
          tooltipRef.current.style.opacity = '1'
        }
      } else if (tooltipRef.current) {
        // Update tooltip position
        tooltipRef.current.style.left = `${event.clientX + 10}px`
        tooltipRef.current.style.top = `${event.clientY + 10}px`
      }
    } else {
      if (hoveredNodeRef.current) {
        const material = hoveredNodeRef.current.material as THREE.MeshStandardMaterial
        material.emissiveIntensity = 0.4
        hoveredNodeRef.current = null

        // Hide tooltip
        if (tooltipRef.current) {
          tooltipRef.current.style.opacity = '0'
          tooltipTimeoutRef.current = window.setTimeout(() => {
            if (tooltipRef.current && hoveredNodeRef.current === null) {
              tooltipRef.current.style.display = 'none'
            }
          }, 200)
        }
      }
    }
  }, [])

  const handleClick = useCallback(() => {
    if (hoveredNodeRef.current) {
      navigate(`/notes/${hoveredNodeRef.current.userData.noteId}`)
    }
  }, [navigate])

  const applyForceDirectedLayout = useCallback(() => {
    const repulsionStrength = 500
    const attractionStrength = 0.01

    // Calculate forces
    const forces = new Map<GraphNode, THREE.Vector3>()

    nodesRef.current.forEach(node => {
      forces.set(node, new THREE.Vector3(0, 0, 0))
    })

    // Repulsion between all nodes
    for (let i = 0; i < nodesRef.current.length; i++) {
      for (let j = i + 1; j < nodesRef.current.length; j++) {
        const node1 = nodesRef.current[i]
        const node2 = nodesRef.current[j]
        const direction = new THREE.Vector3().subVectors(node1.position, node2.position)
        const distance = direction.length()

        if (distance > 0) {
          const force = direction.normalize().multiplyScalar(repulsionStrength / (distance * distance))
          forces.get(node1)!.add(force)
          forces.get(node2)!.sub(force)
        }
      }
    }

    // Attraction along edges
    edgesRef.current.forEach(edge => {
      const source = nodesRef.current.find(n => n.userData.noteId === edge.userData.sourceId)
      const target = nodesRef.current.find(n => n.userData.noteId === edge.userData.targetId)

      if (source && target) {
        const direction = new THREE.Vector3().subVectors(target.position, source.position)
        const distance = direction.length()
        const force = direction.normalize().multiplyScalar(distance * attractionStrength)

        forces.get(source)!.add(force)
        forces.get(target)!.sub(force)
      }
    })

    // Apply forces
    nodesRef.current.forEach(node => {
      const force = forces.get(node)!
      node.position.add(force.multiplyScalar(0.1))

      // Keep nodes within bounds
      node.position.x = Math.max(-50, Math.min(50, node.position.x))
      node.position.y = Math.max(-50, Math.min(50, node.position.y))
      node.position.z = Math.max(-50, Math.min(50, node.position.z))
    })

    // Update edge positions to follow nodes
    edgesRef.current.forEach(edge => {
      const source = nodesRef.current.find(n => n.userData.noteId === edge.userData.sourceId)
      const target = nodesRef.current.find(n => n.userData.noteId === edge.userData.targetId)

      if (source && target && edge.geometry) {
        const positions = edge.geometry.attributes.position
        if (positions) {
          positions.setXYZ(0, source.position.x, source.position.y, source.position.z)
          positions.setXYZ(1, target.position.x, target.position.y, target.position.z)
          positions.needsUpdate = true
        }
      }
    })
  }, [])

  const animate = useCallback(() => {
    animationFrameRef.current = requestAnimationFrame(animate)

    if (controlsRef.current) {
      controlsRef.current.update()
    }

    // Apply force-directed layout
    applyForceDirectedLayout()

    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current)
    }
  }, [applyForceDirectedLayout])

  const initGraph = useCallback(() => {
    if (!containerRef.current) return

    // Scene with dark aurora background
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0f14)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    )
    camera.position.z = 50
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controlsRef.current = controls

    // Ambient lighting with teal tint
    const ambientLight = new THREE.AmbientLight(0x14b8a6, 0.4)
    scene.add(ambientLight)

    // Point lights with teal/cyan glow
    const pointLight1 = new THREE.PointLight(0x14b8a6, 0.8)
    pointLight1.position.set(50, 50, 50)
    scene.add(pointLight1)

    const pointLight2 = new THREE.PointLight(0x06b6d4, 0.6)
    pointLight2.position.set(-50, -50, -50)
    scene.add(pointLight2)

    // Event listeners
    window.addEventListener('resize', handleResize)
    renderer.domElement.addEventListener('mousemove', handleMouseMove)
    renderer.domElement.addEventListener('click', handleClick)

    // Animation loop
    animate()

    // Create tooltip with glass styling
    const tooltip = document.createElement('div')
    tooltip.className = 'fixed px-4 py-2 rounded-xl text-sm pointer-events-none opacity-0 transition-all duration-200 z-50 text-white font-medium shadow-lg'
    tooltip.style.cssText = `
      background: rgba(20, 184, 166, 0.15);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(20, 184, 166, 0.3);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(20, 184, 166, 0.2);
      display: none;
    `
    document.body.appendChild(tooltip)
    tooltipRef.current = tooltip
  }, [animate, handleClick, handleMouseMove, handleResize])

  const buildGraphFromNotes = useCallback((notes: Note[]) => {
    if (!sceneRef.current) return

    // Clear existing graph with proper disposal
    nodesRef.current.forEach(node => {
      node.geometry?.dispose()
      ;(node.material as THREE.Material)?.dispose()
      sceneRef.current?.remove(node)
    })
    edgesRef.current.forEach(edge => {
      edge.geometry?.dispose()
      ;(edge.material as THREE.Material)?.dispose()
      sceneRef.current?.remove(edge)
    })
    nodesRef.current = []
    edgesRef.current = []

    if (notes.length === 0) return

    // Build links based on temporal proximity (within 7 days)
    const links: { source: string; target: string; value: number }[] = []
    for (let i = 0; i < notes.length; i++) {
      for (let j = i + 1; j < notes.length; j++) {
        const daysDiff =
          Math.abs(new Date(notes[i].created_at).getTime() - new Date(notes[j].created_at).getTime()) /
          (1000 * 60 * 60 * 24)

        if (daysDiff < 7) {
          links.push({
            source: notes[i].id,
            target: notes[j].id,
            value: 1 - daysDiff / 7, // Stronger link if closer in time
          })
        }
      }
    }

    // Calculate connection counts
    const connectionCounts = new Map<string, number>()
    links.forEach(link => {
      connectionCounts.set(link.source, (connectionCounts.get(link.source) || 0) + 1)
      connectionCounts.set(link.target, (connectionCounts.get(link.target) || 0) + 1)
    })

    // Find date range for glow intensity
    const dates = notes.map(n => new Date(n.created_at).getTime())
    const minDate = Math.min(...dates)
    const maxDate = Math.max(...dates)

    // Create node meshes with teal theme
    const nodeMap = new Map<string, GraphNode>()
    notes.forEach(note => {
      const connectionCount = connectionCounts.get(note.id) || 0
      const baseSize = 2
      const nodeSize = baseSize + connectionCount * 0.5

      const noteDate = new Date(note.created_at).getTime()
      const ageRatio = maxDate !== minDate ? (noteDate - minDate) / (maxDate - minDate) : 0.5

      // Teal color with slight variation based on age
      const baseColor = new THREE.Color(0x14b8a6)
      const accentColor = new THREE.Color(0x06b6d4)
      const color = new THREE.Color().lerpColors(baseColor, accentColor, ageRatio)

      const glowIntensity = 0.3 + ageRatio * 0.4

      const geometry = new THREE.SphereGeometry(nodeSize, 32, 32)
      const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: glowIntensity,
        metalness: 0.4,
        roughness: 0.3,
        transparent: true,
        opacity: 0.9,
      })

      const node = new THREE.Mesh(geometry, material) as unknown as GraphNode
      node.userData = {
        noteId: note.id,
        title: note.title || 'Untitled Note',
        createdAt: new Date(note.created_at),
        connectionCount,
      }

      node.position.set(
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40
      )

      sceneRef.current!.add(node)
      nodesRef.current.push(node)
      nodeMap.set(note.id, node)
    })

    // Create edges with cyan gradient
    links.forEach(link => {
      const sourceNode = nodeMap.get(link.source)
      const targetNode = nodeMap.get(link.target)

      if (sourceNode && targetNode) {
        const material = new THREE.LineBasicMaterial({
          color: 0x06b6d4, // Cyan
          transparent: true,
          opacity: Math.min(0.6, link.value * 0.8 + 0.1),
        })

        const geometry = new THREE.BufferGeometry().setFromPoints([
          sourceNode.position,
          targetNode.position,
        ])

        const edge = new THREE.Line(geometry, material) as unknown as GraphEdge
        edge.userData = {
          sourceId: link.source,
          targetId: link.target,
        }

        sceneRef.current!.add(edge)
        edgesRef.current.push(edge)
      }
    })

    setNoteCount(notes.length)
  }, [])

  const fetchNotes = useCallback(async () => {
    if (!workspace) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data: notes, error: fetchError } = await supabase
        .from('notes')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      buildGraphFromNotes(notes || [])
    } catch (err) {
      setError('Failed to load notes for graph view. Please try again.')
      console.error('Error fetching notes for graph:', err)
    } finally {
      setLoading(false)
    }
  }, [workspace, buildGraphFromNotes])

  const cleanup = useCallback(() => {
    window.removeEventListener('resize', handleResize)

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    if (rendererRef.current && containerRef.current) {
      rendererRef.current.domElement.removeEventListener('mousemove', handleMouseMove)
      rendererRef.current.domElement.removeEventListener('click', handleClick)
      if (containerRef.current.contains(rendererRef.current.domElement)) {
        containerRef.current.removeChild(rendererRef.current.domElement)
      }
    }

    if (tooltipRef.current && document.body.contains(tooltipRef.current)) {
      document.body.removeChild(tooltipRef.current)
    }

    if (rendererRef.current) {
      rendererRef.current.dispose()
    }

    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current)
    }

    nodesRef.current = []
    edgesRef.current = []
  }, [handleClick, handleMouseMove, handleResize])

  // Initialize graph
  useEffect(() => {
    initGraph()
    return () => {
      cleanup()
    }
  }, [initGraph, cleanup])

  // Fetch notes when workspace changes
  useEffect(() => {
    if (workspace) {
      fetchNotes()
    }
  }, [workspace, fetchNotes])

  // Real-time subscription for notes changes
  useEffect(() => {
    if (!workspace) return

    const channel = supabase
      .channel('graph_notes_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `workspace_id=eq.${workspace.id}`,
        },
        () => {
          // Refetch notes when any changes occur
          fetchNotes()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspace, fetchNotes])

  return (
    <div className="h-screen w-full relative bg-base-dark overflow-hidden">
      {/* Error Message with glass styling */}
      {error && (
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-20">
          <div
            className="px-6 py-4 rounded-2xl shadow-xl border border-red-500/30"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="flex items-center gap-3">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State with teal spinner */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-base-dark/80 backdrop-blur-sm z-10">
          <div
            className="rounded-2xl shadow-xl p-8 text-center border border-accent/20"
            style={{
              background: 'rgba(20, 184, 166, 0.05)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <div className="relative mx-auto mb-4 w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-accent/20"></div>
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin"></div>
            </div>
            <p className="text-gray-300">Loading knowledge graph...</p>
          </div>
        </div>
      )}

      {/* Graph Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Back button */}
      <button
        onClick={() => navigate('/notes')}
        className="absolute top-6 left-6 z-10 px-4 py-2 rounded-xl text-white/80 hover:text-white transition-all duration-200 flex items-center gap-2 border border-white/10 hover:border-accent/30"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span className="text-sm font-medium">Back to Notes</span>
      </button>

      {/* Legend with glassmorphism */}
      <div
        className="absolute bottom-6 left-6 rounded-2xl shadow-xl p-5 z-10 border border-white/10"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <h3 className="text-sm font-semibold text-white/90 mb-3">Knowledge Graph</h3>
        <div className="space-y-2 text-xs text-gray-400">
          <div className="flex items-center">
            <div
              className="w-4 h-4 rounded-full mr-3"
              style={{
                background: '#14b8a6',
                boxShadow: '0 0 12px rgba(20, 184, 166, 0.5)',
              }}
            ></div>
            <span>Notes ({noteCount})</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-0.5 mr-3" style={{ background: '#06b6d4' }}></div>
            <span>Temporal connections</span>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 space-y-1">
            <p className="text-gray-500">Drag to rotate</p>
            <p className="text-gray-500">Scroll to zoom</p>
            <p className="text-gray-500">Click node to view note</p>
          </div>
        </div>
      </div>

      {/* Stats badge */}
      {!loading && noteCount > 0 && (
        <div
          className="absolute top-6 right-6 z-10 px-4 py-2 rounded-xl border border-accent/20"
          style={{
            background: 'rgba(20, 184, 166, 0.1)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <span className="text-accent text-sm font-medium">{noteCount} notes</span>
          <span className="text-gray-500 text-sm ml-2">in your knowledge graph</span>
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { api } from '../lib/api';
import type { Note, NoteWithDetails } from '../../../shared/types';

interface GraphNode extends THREE.Mesh {
    userData: {
        noteId: string;
        title: string;
        createdAt: Date;
        connectionCount: number;
    };
}

interface GraphEdge extends THREE.Line {
    userData: {
        sourceId: string;
        targetId: string;
    };
}

export default function GraphView() {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
    const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
    const nodesRef = useRef<GraphNode[]>([]);
    const edgesRef = useRef<GraphEdge[]>([]);
    const hoveredNodeRef = useRef<GraphNode | null>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);

    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        initGraph();
        fetchNotes();

        return () => {
            cleanup();
        };
    }, []);

    const initGraph = () => {
        if (!containerRef.current) return;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(
            75,
            containerRef.current.clientWidth / containerRef.current.clientHeight,
            0.1,
            1000
        );
        camera.position.z = 50;
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controlsRef.current = controls;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xffffff, 0.8);
        pointLight.position.set(50, 50, 50);
        scene.add(pointLight);

        // Event listeners
        window.addEventListener('resize', handleResize);
        renderer.domElement.addEventListener('mousemove', handleMouseMove);
        renderer.domElement.addEventListener('click', handleClick);

        // Animation loop
        animate();

        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'absolute bg-gray-900 text-white px-3 py-2 rounded-lg text-sm pointer-events-none opacity-0 transition-opacity duration-200 z-50';
        tooltip.style.display = 'none';
        document.body.appendChild(tooltip);
        tooltipRef.current = tooltip;
    };

    const cleanup = () => {
        window.removeEventListener('resize', handleResize);

        if (rendererRef.current && containerRef.current) {
            rendererRef.current.domElement.removeEventListener('mousemove', handleMouseMove);
            rendererRef.current.domElement.removeEventListener('click', handleClick);
            containerRef.current.removeChild(rendererRef.current.domElement);
        }

        if (tooltipRef.current) {
            document.body.removeChild(tooltipRef.current);
        }

        nodesRef.current = [];
        edgesRef.current = [];
    };

    const handleResize = () => {
        if (!cameraRef.current || !rendererRef.current || !containerRef.current) return;

        cameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };

    const handleMouseMove = (event: MouseEvent) => {
        if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        const intersects = raycasterRef.current.intersectObjects(nodesRef.current);

        if (intersects.length > 0) {
            const node = intersects[0].object as GraphNode;

            if (hoveredNodeRef.current !== node) {
                // Reset previous hovered node
                if (hoveredNodeRef.current) {
                    const material = hoveredNodeRef.current.material as THREE.MeshStandardMaterial;
                    material.emissive.setHex(0x000000);
                }

                // Highlight new hovered node
                hoveredNodeRef.current = node;
                const material = node.material as THREE.MeshStandardMaterial;
                material.emissive.setHex(0x444444);

                // Show tooltip
                if (tooltipRef.current) {
                    tooltipRef.current.textContent = node.userData.title;
                    tooltipRef.current.style.display = 'block';
                    tooltipRef.current.style.left = `${event.clientX + 10}px`;
                    tooltipRef.current.style.top = `${event.clientY + 10}px`;
                    tooltipRef.current.style.opacity = '1';
                }
            } else if (tooltipRef.current) {
                // Update tooltip position
                tooltipRef.current.style.left = `${event.clientX + 10}px`;
                tooltipRef.current.style.top = `${event.clientY + 10}px`;
            }
        } else {
            if (hoveredNodeRef.current) {
                const material = hoveredNodeRef.current.material as THREE.MeshStandardMaterial;
                material.emissive.setHex(0x000000);
                hoveredNodeRef.current = null;

                // Hide tooltip
                if (tooltipRef.current) {
                    tooltipRef.current.style.opacity = '0';
                    setTimeout(() => {
                        if (tooltipRef.current && hoveredNodeRef.current === null) {
                            tooltipRef.current.style.display = 'none';
                        }
                    }, 200);
                }
            }
        }
    };

    const handleClick = () => {
        if (hoveredNodeRef.current) {
            navigate(`/notes/${hoveredNodeRef.current.userData.noteId}`);
        }
    };

    const animate = () => {
        requestAnimationFrame(animate);

        if (controlsRef.current) {
            controlsRef.current.update();
        }

        // Apply force-directed layout
        applyForceDirectedLayout();

        if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
    };

    const applyForceDirectedLayout = () => {
        const repulsionStrength = 500;
        const attractionStrength = 0.01;

        // Calculate forces
        const forces = new Map<GraphNode, THREE.Vector3>();

        nodesRef.current.forEach(node => {
            forces.set(node, new THREE.Vector3(0, 0, 0));
        });

        // Repulsion between all nodes
        for (let i = 0; i < nodesRef.current.length; i++) {
            for (let j = i + 1; j < nodesRef.current.length; j++) {
                const node1 = nodesRef.current[i];
                const node2 = nodesRef.current[j];
                const direction = new THREE.Vector3().subVectors(node1.position, node2.position);
                const distance = direction.length();

                if (distance > 0) {
                    const force = direction.normalize().multiplyScalar(repulsionStrength / (distance * distance));
                    forces.get(node1)!.add(force);
                    forces.get(node2)!.sub(force);
                }
            }
        }

        // Attraction along edges
        edgesRef.current.forEach(edge => {
            const source = nodesRef.current.find(n => n.userData.noteId === edge.userData.sourceId);
            const target = nodesRef.current.find(n => n.userData.noteId === edge.userData.targetId);

            if (source && target) {
                const direction = new THREE.Vector3().subVectors(target.position, source.position);
                const distance = direction.length();
                const force = direction.normalize().multiplyScalar(distance * attractionStrength);

                forces.get(source)!.add(force);
                forces.get(target)!.sub(force);
            }
        });

        // Apply forces
        nodesRef.current.forEach(node => {
            const force = forces.get(node)!;
            node.position.add(force.multiplyScalar(0.1));

            // Keep nodes within bounds
            node.position.x = Math.max(-50, Math.min(50, node.position.x));
            node.position.y = Math.max(-50, Math.min(50, node.position.y));
            node.position.z = Math.max(-50, Math.min(50, node.position.z));
        });
    };

    const fetchNotes = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch all notes
            const allNotes: Note[] = [];
            let page = 1;
            let hasMore = true;

            while (hasMore) {
                const response = await api.notes.list(page, 50);
                const notesWithDates: Note[] = response.notes.map(note => ({
                    ...note,
                    created_at: new Date(note.created_at),
                    updated_at: new Date(note.updated_at),
                }));
                allNotes.push(...notesWithDates);
                hasMore = notesWithDates.length === 50;
                page++;
            }

            // Fetch detailed notes to get connection information
            const notesWithDetails: NoteWithDetails[] = await Promise.all(
                allNotes.map(note => api.notes.get(note.id))
            );

            // Calculate connection counts
            const connectionCounts = new Map<string, number>();
            notesWithDetails.forEach(note => {
                const count = (note.related_notes?.length || 0) + (note.manual_links?.length || 0);
                connectionCounts.set(note.id, count);
            });

            // Clear existing graph
            nodesRef.current.forEach(node => {
                if (sceneRef.current) {
                    sceneRef.current.remove(node);
                }
            });
            edgesRef.current.forEach(edge => {
                if (sceneRef.current) {
                    sceneRef.current.remove(edge);
                }
            });
            nodesRef.current = [];
            edgesRef.current = [];

            // Find date range for color gradient
            const dates = notesWithDetails.map(n => n.created_at.getTime());
            const minDate = Math.min(...dates);
            const maxDate = Math.max(...dates);

            // Create nodes
            notesWithDetails.forEach(note => {
                const connectionCount = connectionCounts.get(note.id) || 0;
                const baseSize = 2;
                const nodeSize = baseSize + connectionCount * 0.5;

                // Calculate color based on recency (blue = older, purple = newer)
                const ageRatio = (note.created_at.getTime() - minDate) / (maxDate - minDate || 1);
                const color = new THREE.Color().lerpColors(
                    new THREE.Color(0x3b82f6), // blue
                    new THREE.Color(0x8b5cf6), // purple
                    ageRatio
                );

                // Calculate glow opacity based on recency (0.3 to 1.0)
                const glowOpacity = 0.3 + ageRatio * 0.7;

                const geometry = new THREE.SphereGeometry(nodeSize, 32, 32);
                const material = new THREE.MeshStandardMaterial({
                    color: color,
                    emissive: color,
                    emissiveIntensity: glowOpacity * 0.5,
                    metalness: 0.3,
                    roughness: 0.7,
                });

                const node = new THREE.Mesh(geometry, material) as unknown as GraphNode;
                node.userData = {
                    noteId: note.id,
                    title: note.title || 'Untitled Note',
                    createdAt: note.created_at,
                    connectionCount,
                };

                // Random initial position
                node.position.set(
                    (Math.random() - 0.5) * 40,
                    (Math.random() - 0.5) * 40,
                    (Math.random() - 0.5) * 40
                );

                if (sceneRef.current) {
                    sceneRef.current.add(node);
                }
                nodesRef.current.push(node);
            });

            // Create edges (connections)
            notesWithDetails.forEach(note => {
                if (note.related_notes) {
                    note.related_notes.forEach(related => {
                        const sourceNode = nodesRef.current.find(n => n.userData.noteId === note.id);
                        const targetNode = nodesRef.current.find(n => n.userData.noteId === related.id);

                        if (sourceNode && targetNode) {
                            const material = new THREE.LineBasicMaterial({
                                color: 0x6b7280,
                                transparent: true,
                                opacity: 0.3,
                            });

                            const geometry = new THREE.BufferGeometry().setFromPoints([
                                sourceNode.position,
                                targetNode.position,
                            ]);

                            const edge = new THREE.Line(geometry, material) as unknown as GraphEdge;
                            edge.userData = {
                                sourceId: note.id,
                                targetId: related.id,
                            };

                            if (sceneRef.current) {
                                sceneRef.current.add(edge);
                            }
                            edgesRef.current.push(edge);
                        }
                    });
                }
            });

        } catch (err) {
            setError('Failed to load notes for graph view. Please try again.');
            console.error('Error fetching notes for graph:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen w-full relative">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 bg-white/90 backdrop-blur-sm shadow-md z-10 px-6 py-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Knowledge Graph</h1>
                        <p className="text-sm text-gray-600">Visualize connections between your notes</p>
                    </div>
                    <button
                        onClick={() => navigate('/notes')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        Back to Notes
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-20">
                    <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded shadow-lg">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg
                                    className="h-5 w-5 text-red-400"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
                    <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-700">Loading knowledge graph...</p>
                    </div>
                </div>
            )}

            {/* Graph Container */}
            <div ref={containerRef} className="w-full h-full" />

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-4 z-10">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Legend</h3>
                <div className="space-y-2 text-xs text-gray-600">
                    <div className="flex items-center">
                        <div className="w-4 h-4 rounded-full bg-blue-500 mr-2"></div>
                        <span>Older notes</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-4 h-4 rounded-full bg-purple-500 mr-2"></div>
                        <span>Newer notes</span>
                    </div>
                    <div className="flex items-center">
                        <div className="w-4 h-4 rounded-full bg-gray-400 mr-2"></div>
                        <span>Connections</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-200">
                        <p>• Drag to rotate</p>
                        <p>• Scroll to zoom</p>
                        <p>• Click node to view note</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Home() {
    const { isAuthenticated } = useAuth()

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center py-12">
                <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
                    Welcome to Synapse Notes
                </h1>
                <p className="mt-5 max-w-xl mx-auto text-xl text-gray-500">
                    Your intelligent voice note-taking companion. Capture ideas, organize thoughts, and discover connections with the power of AI.
                </p>
                <div className="mt-10 flex justify-center gap-4">
                    {isAuthenticated ? (
                        <Link
                            to="/notes"
                            className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 md:text-lg md:px-10"
                        >
                            Go to Notes
                        </Link>
                    ) : (
                        <>
                            <Link
                                to="/register"
                                className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 md:text-lg md:px-10"
                            >
                                Get Started
                            </Link>
                            <Link
                                to="/login"
                                className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 md:text-lg md:px-10"
                            >
                                Sign In
                            </Link>
                        </>
                    )}
                </div>
            </div>

            <div className="mt-16">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <dt className="text-sm font-medium text-gray-500 truncate">
                                Voice Notes
                            </dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                                🎤
                            </dd>
                            <p className="mt-2 text-sm text-gray-500">
                                Record voice notes with automatic transcription powered by AI
                            </p>
                        </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <dt className="text-sm font-medium text-gray-500 truncate">
                                Semantic Search
                            </dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                                🔍
                            </dd>
                            <p className="mt-2 text-sm text-gray-500">
                                Find notes by meaning, not just keywords, using advanced embeddings
                            </p>
                        </div>
                    </div>

                    <div className="bg-white overflow-hidden shadow rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            <dt className="text-sm font-medium text-gray-500 truncate">
                                Knowledge Graph
                            </dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                                🕸️
                            </dd>
                            <p className="mt-2 text-sm text-gray-500">
                                Visualize connections between your notes and discover new insights
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

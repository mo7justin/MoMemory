'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from "@/components/shared/LanguageContext";
import { t } from "@/lib/locales";
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import ForceGraph2D to avoid SSR issues with canvas
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  ),
});

interface GraphNode {
  id: string;
  group: string;
  val: number;
  name: string;
  color?: string;
}

interface GraphLink {
  source: string;
  target: string;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export default function GraphPage() {
  const { locale } = useLanguage();
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const graphRef = useRef<any>();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/graph/data', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch graph data');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error loading graph data:', err);
      setError('Failed to load graph data. Ensure Neo4j is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleZoomIn = () => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() * 1.2, 400);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() / 1.2, 400);
    }
  };

  const handleFit = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-500" />
            {t('graphMemory', locale)}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Visualize relationships between your memories
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleFit} title="Fit to Screen">
            <Maximize className="w-4 h-4" />
          </Button>
          <Button onClick={fetchData} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Reload
          </Button>
        </div>
      </div>

      {/* Graph Container */}
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-red-500 bg-white/50 dark:bg-black/50 z-10">
            <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
              <p className="font-medium mb-2">Error Loading Graph</p>
              <p className="text-sm text-gray-500">{error}</p>
              <Button variant="outline" className="mt-4" onClick={fetchData}>Try Again</Button>
            </div>
          </div>
        ) : (
          <ForceGraph2D
            ref={graphRef}
            graphData={data}
            nodeLabel="name"
            nodeColor={(node: any) => node.color || '#3b82f6'}
            nodeRelSize={6}
            linkColor={() => 'rgba(156, 163, 175, 0.3)'} // gray-400 with opacity
            linkDirectionalArrowLength={3.5}
            linkDirectionalArrowRelPos={1}
            cooldownTicks={100}
            onNodeClick={(node: any) => {
              // Center on click
              if (graphRef.current) {
                graphRef.current.centerAt(node.x, node.y, 1000);
                graphRef.current.zoom(2, 2000);
              }
            }}
            backgroundColor={typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? '#111827' : '#f9fafb'}
          />
        )}
        
        {/* Stats Overlay */}
        <div className="absolute bottom-4 left-4 pointer-events-none">
          <Card className="p-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm shadow-lg border-none">
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400 block text-xs uppercase tracking-wider">Nodes</span>
                <span className="font-bold text-xl text-gray-900 dark:text-white">{data.nodes.length}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 block text-xs uppercase tracking-wider">Relations</span>
                <span className="font-bold text-xl text-gray-900 dark:text-white">{data.links.length}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface Note {
  id: string;
  content: string;
  category_name?: string;
}

interface Connection {
  source_note_id: string;
  target_note_id: string;
  similarity_score: number;
}

interface GraphNode {
  id: string;
  content: string;
  category: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphLink {
  source: string;
  target: string;
  strength: number;
}

const GraphView = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    fetchGraphData();

    const channel = supabase
      .channel('graph-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, fetchGraphData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'note_connections' }, fetchGraphData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const fetchGraphData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch notes with categories
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select(`
          id,
          content,
          categories (name)
        `)
        .eq('user_id', user.id);

      if (notesError) throw notesError;

      // Fetch connections
      const { data: connectionsData, error: connectionsError } = await supabase
        .from('note_connections')
        .select('source_note_id, target_note_id, similarity_score');

      if (connectionsError) throw connectionsError;

      // Initialize nodes with random positions
      const canvas = canvasRef.current;
      const centerX = canvas ? canvas.width / 2 : 400;
      const centerY = canvas ? canvas.height / 2 : 300;

      const newNodes: GraphNode[] = notesData.map((note: any) => ({
        id: note.id,
        content: note.content.substring(0, 50),
        category: note.categories?.name || 'Uncategorized',
        x: centerX + (Math.random() - 0.5) * 200,
        y: centerY + (Math.random() - 0.5) * 200,
        vx: 0,
        vy: 0,
      }));

      const newLinks: GraphLink[] = connectionsData.map((conn: Connection) => ({
        source: conn.source_note_id,
        target: conn.target_note_id,
        strength: conn.similarity_score,
      }));

      setNodes(newNodes);
      setLinks(newLinks);
    } catch (error: any) {
      console.error('Error fetching graph data:', error);
      toast.error('Failed to load graph');
    }
  };

  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Force-directed graph simulation
    const simulate = () => {
      const alpha = 0.1;
      const linkDistance = 150;
      const linkStrength = 0.3;
      const repulsion = 3000;

      // Apply forces
      nodes.forEach((node, i) => {
        let fx = 0, fy = 0;

        // Repulsion between nodes
        nodes.forEach((other, j) => {
          if (i === j) return;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsion / (distance * distance);
          fx += (dx / distance) * force;
          fy += (dy / distance) * force;
        });

        // Attraction along links
        links.forEach(link => {
          if (link.source === node.id) {
            const target = nodes.find(n => n.id === link.target);
            if (target) {
              const dx = target.x - node.x;
              const dy = target.y - node.y;
              const distance = Math.sqrt(dx * dx + dy * dy) || 1;
              const force = (distance - linkDistance) * linkStrength * link.strength;
              fx += (dx / distance) * force;
              fy += (dy / distance) * force;
            }
          }
          if (link.target === node.id) {
            const source = nodes.find(n => n.id === link.source);
            if (source) {
              const dx = source.x - node.x;
              const dy = source.y - node.y;
              const distance = Math.sqrt(dx * dx + dy * dy) || 1;
              const force = (distance - linkDistance) * linkStrength * link.strength;
              fx += (dx / distance) * force;
              fy += (dy / distance) * force;
            }
          }
        });

        // Center gravity
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        fx += (centerX - node.x) * 0.01;
        fy += (centerY - node.y) * 0.01;

        // Update velocity
        node.vx = (node.vx + fx * alpha) * 0.9;
        node.vy = (node.vy + fy * alpha) * 0.9;

        // Update position
        node.x += node.vx;
        node.y += node.vy;

        // Keep in bounds
        node.x = Math.max(30, Math.min(canvas.width - 30, node.x));
        node.y = Math.max(30, Math.min(canvas.height - 30, node.y));
      });

      // Draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw links
      links.forEach(link => {
        const source = nodes.find(n => n.id === link.source);
        const target = nodes.find(n => n.id === link.target);
        if (source && target) {
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.strokeStyle = `hsla(262, 83%, 58%, ${link.strength * 0.5})`;
          ctx.lineWidth = 1 + link.strength;
          ctx.stroke();
        }
      });

      // Draw nodes
      nodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = node === selectedNode ? 'hsl(262, 83%, 58%)' : 'hsl(262, 83%, 70%)';
        ctx.fill();
        ctx.strokeStyle = 'hsl(0, 0%, 100%)';
        ctx.lineWidth = 2;
        ctx.stroke();
      });

      animationRef.current = requestAnimationFrame(simulate);
    };

    simulate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [nodes, links, selectedNode]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clicked = nodes.find(node => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 15;
    });

    setSelectedNode(clicked || null);
  };

  return (
    <div className="h-full flex gap-4">
      <Card className="flex-1 p-4 relative">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="w-full h-full cursor-pointer"
          style={{ minHeight: '600px' }}
        />
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground">No notes yet. Start creating to see your brain map!</p>
          </div>
        )}
      </Card>

      {selectedNode && (
        <Card className="w-80 p-6">
          <h3 className="font-semibold mb-2 text-primary">Selected Note</h3>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Category: {selectedNode.category}</p>
            <p className="text-sm">{selectedNode.content}...</p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default GraphView;

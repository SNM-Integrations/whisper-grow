import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AudioUploadProps {
  onTranscriptComplete: (text: string) => void;
}

const AudioUpload = ({ onTranscriptComplete }: AudioUploadProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's a text file
    if (file.type === 'text/plain' || file.name.match(/\.txt$/i)) {
      await processTextFile(file);
      return;
    }

    // Check file size (25MB limit for Whisper API)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (file.size > maxSize) {
      toast.error("File size exceeds 25MB limit");
      return;
    }

    // Check file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/m4a', 'audio/mp4', 'audio/ogg'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|webm|m4a|ogg)$/i)) {
      toast.error("Invalid file format. Supported: MP3, WAV, WebM, M4A, OGG, TXT");
      return;
    }

    await processAudio(file);
  };

  const processTextFile = async (file: File) => {
    setIsProcessing(true);
    try {
      const text = await file.text();
      
      if (!text.trim()) {
        throw new Error('Text file is empty');
      }

      onTranscriptComplete(text);
      toast.success("Text file imported successfully");
    } catch (error) {
      console.error("Error processing text file:", error);
      toast.error("Failed to read text file");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const processAudio = async (file: File) => {
    setIsProcessing(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        
        if (!base64Audio) {
          throw new Error('Failed to convert audio');
        }

        toast.info("Transcribing audio...");

        const { data, error } = await supabase.functions.invoke('transcribe-audio', {
          body: { audio: base64Audio }
        });

        if (error) throw error;

        if (data?.text) {
          onTranscriptComplete(data.text);
          toast.success("Audio transcribed successfully");
        }
      };
    } catch (error) {
      console.error("Error processing audio:", error);
      toast.error("Failed to transcribe audio");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.webm,.m4a,.ogg,.txt"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isProcessing}
      />
      <Button
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        {isProcessing ? "Processing..." : "Upload Audio or Text File"}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Supports MP3, WAV, WebM, M4A, OGG (max 25MB) or TXT files
      </p>
    </div>
  );
};

export default AudioUpload;

import { Search, Wifi, WifiOff, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface GameHeaderProps {
  roomData: any;
  isConnected: boolean;
}

export default function GameHeader({ roomData, isConnected }: GameHeaderProps) {
  return (
    <header className="mystery-bg/90 backdrop-blur-sm border-b border-slate-600 px-4 py-3 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Search className="detective-text text-2xl" size={32} />
          <h1 className="text-xl font-bold text-white">Mystery Language Quest</h1>
          {roomData && (
            <Badge variant="outline" className="border-slate-500 text-slate-300">
              {roomData.name}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Language Selector */}
          <Select value={roomData?.language || "spanish"} disabled>
            <SelectTrigger className="bg-slate-700 border-slate-600 text-white w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="spanish">Learning Spanish</SelectItem>
              <SelectItem value="french">Learning French</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <>
                <Wifi className="progress-text" size={16} />
                <span className="text-sm text-progress">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="text-red-400" size={16} />
                <span className="text-sm text-red-400">Disconnected</span>
              </>
            )}
          </div>
          
          {/* Help Button */}
          <Button 
            variant="outline" 
            size="sm"
            className="hint-bg border-blue-600 text-white hover:bg-blue-600"
          >
            <HelpCircle size={16} className="mr-1" />
            Help
          </Button>
        </div>
      </div>
    </header>
  );
}

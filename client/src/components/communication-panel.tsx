import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MessageCircle, 
  Send, 
  Share, 
  Languages, 
  GraduationCap, 
  Settings,
  Zap
} from "lucide-react";

interface ChatMessage {
  id: number;
  playerId: number;
  message: string;
  sentAt: Date;
  playerName?: string;
  characterType?: string;
}

interface TeamMember {
  id: number;
  displayName: string;
  characterType: string;
  isCurrentPlayer?: boolean;
}

interface CommunicationPanelProps {
  chatMessages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onGameAction: (action: any) => void;
  teamMembers: TeamMember[];
}

const CHARACTER_ICONS = {
  detective: "🔍",
  linguist: "📚",
  translator: "🌐",
  cultural_expert: "🏛️"
};

const CHARACTER_COLORS = {
  detective: "detective-text",
  linguist: "text-blue-400",
  translator: "text-green-400",
  cultural_expert: "text-purple-400"
};

export default function CommunicationPanel({ 
  chatMessages, 
  onSendMessage, 
  onGameAction, 
  teamMembers 
}: CommunicationPanelProps) {
  const [messageInput, setMessageInput] = useState("");
  const [soundEffects, setSoundEffects] = useState(true);
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [hintLevel, setHintLevel] = useState("beginner");

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      onSendMessage(messageInput);
      setMessageInput("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleShareClue = () => {
    onGameAction({
      type: 'share_clue',
      actionType: 'clue_shared',
      actionData: { clueId: 'current_clue' },
      pointsAwarded: 10
    });
  };

  const handleRequestTranslation = () => {
    onGameAction({
      type: 'request_translation',
      actionType: 'translation_requested',
      actionData: { requestType: 'help_needed' },
      pointsAwarded: 0
    });
  };

  const handleShareVocabulary = () => {
    onGameAction({
      type: 'share_vocabulary',
      actionType: 'vocabulary_shared',
      actionData: { words: ['reunión', 'secreta'] },
      pointsAwarded: 15
    });
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h ago`;
  };

  return (
    <div className="space-y-4">
      {/* Team Chat */}
      <Card className="glass-effect border-slate-600 flex flex-col h-96">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <MessageCircle className="hint-text mr-2" size={20} />
            Team Chat
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 flex flex-col p-0">
          {/* Chat Messages */}
          <ScrollArea className="flex-1 px-4">
            <div className="space-y-3 pb-4">
              {chatMessages.map((message) => {
                const member = teamMembers.find(m => m.id === message.playerId);
                const icon = CHARACTER_ICONS[member?.characterType as keyof typeof CHARACTER_ICONS] || "👤";
                const colorClass = CHARACTER_COLORS[member?.characterType as keyof typeof CHARACTER_COLORS] || "text-slate-400";
                
                return (
                  <div key={message.id} className="flex items-start space-x-2">
                    <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm">{icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`text-sm font-medium ${colorClass}`}>
                          {member?.displayName || 'Unknown'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatTime(message.sentAt)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 break-words">{message.message}</p>
                    </div>
                  </div>
                );
              })}
              
              {chatMessages.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs">Start chatting with your team!</p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Chat Input */}
          <div className="p-4 border-t border-slate-600">
            <div className="flex space-x-2">
              <Input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message to your team..."
                className="flex-1 bg-slate-700 border-slate-600 text-white focus:border-blue-500"
              />
              <Button 
                onClick={handleSendMessage}
                className="hint-bg hover:bg-blue-600"
                size="sm"
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="glass-effect border-slate-600">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Zap className="detective-text mr-2" size={20} />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            onClick={handleShareClue}
            variant="outline"
            className="w-full justify-start detective-bg/20 border-amber-500/30 hover:bg-amber-500/30"
          >
            <div className="flex items-center justify-between w-full">
              <div className="text-left">
                <div className="font-medium detective-text">Share Current Clue</div>
                <div className="text-xs text-slate-400">Let teammates see what you found</div>
              </div>
              <Share className="detective-text" size={16} />
            </div>
          </Button>

          <Button
            onClick={handleRequestTranslation}
            variant="outline"
            className="w-full justify-start hint-bg/20 border-blue-500/30 hover:bg-blue-500/30"
          >
            <div className="flex items-center justify-between w-full">
              <div className="text-left">
                <div className="font-medium hint-text">Request Translation</div>
                <div className="text-xs text-slate-400">Ask for help with foreign text</div>
              </div>
              <Languages className="hint-text" size={16} />
            </div>
          </Button>

          <Button
            onClick={handleShareVocabulary}
            variant="outline"
            className="w-full justify-start progress-bg/20 border-green-500/30 hover:bg-green-500/30"
          >
            <div className="flex items-center justify-between w-full">
              <div className="text-left">
                <div className="font-medium progress-text">Share Vocabulary</div>
                <div className="text-xs text-slate-400">Teach new words to teammates</div>
              </div>
              <GraduationCap className="progress-text" size={16} />
            </div>
          </Button>
        </CardContent>
      </Card>

      {/* Game Settings */}
      <Card className="glass-effect border-slate-600">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Settings className="text-slate-400 mr-2" size={20} />
            Game Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="hint-level" className="text-sm text-slate-200">Hint Level</Label>
            <Select value={hintLevel} onValueChange={setHintLevel}>
              <SelectTrigger className="w-28 bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="sound-effects" className="text-sm text-slate-200">Sound Effects</Label>
            <Switch
              id="sound-effects"
              checked={soundEffects}
              onCheckedChange={setSoundEffects}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="auto-translate" className="text-sm text-slate-200">Auto-translate</Label>
            <Switch
              id="auto-translate"
              checked={autoTranslate}
              onCheckedChange={setAutoTranslate}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

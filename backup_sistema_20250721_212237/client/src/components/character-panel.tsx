import { Users, TrendingUp, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface TeamMember {
  id: number;
  displayName: string;
  characterType: string;
  score: number;
  isOnline: boolean;
  isCurrentPlayer?: boolean;
}

interface PlayerProgress {
  mysteryProgress: number;
  vocabularyLearned: number;
  totalScore: number;
  cluesFound: number;
  totalClues: number;
}

interface CharacterPanelProps {
  teamMembers: TeamMember[];
  playerProgress: PlayerProgress;
  currentPlayer?: TeamMember;
}

const CHARACTER_INFO = {
  detective: {
    name: "Detective",
    icon: "🔍",
    color: "detective-text",
    bgColor: "detective-bg/20",
    borderColor: "border-amber-500",
    description: "Can analyze physical clues and interview witnesses"
  },
  linguist: {
    name: "Linguist",
    icon: "📚",
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    borderColor: "border-blue-500",
    description: "Can decode language patterns and grammar clues"
  },
  translator: {
    name: "Translator",
    icon: "🌐",
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    borderColor: "border-green-500",
    description: "Can translate documents and foreign phrases"
  },
  cultural_expert: {
    name: "Cultural Expert",
    icon: "🏛️",
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
    borderColor: "border-purple-500",
    description: "Can interpret cultural references and context"
  }
};

export default function CharacterPanel({ teamMembers, playerProgress, currentPlayer }: CharacterPanelProps) {
  return (
    <div className="space-y-4">
      {/* Team Members */}
      <Card className="glass-effect border-slate-600">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Users className="detective-text mr-2" size={20} />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {teamMembers.map((member) => {
            const info = CHARACTER_INFO[member.characterType as keyof typeof CHARACTER_INFO];
            if (!info) return null;

            return (
              <Card
                key={member.id}
                className={`${
                  member.isCurrentPlayer 
                    ? `${info.bgColor} border-2 ${info.borderColor}` 
                    : 'bg-slate-700/50 border-slate-600'
                } transition-colors`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{info.icon}</span>
                      <span className={`font-semibold ${info.color}`}>{info.name}</span>
                    </div>
                    <Badge 
                      variant={member.isCurrentPlayer ? "default" : "secondary"}
                      className={member.isCurrentPlayer ? "progress-bg" : "bg-slate-600"}
                    >
                      {member.isCurrentPlayer ? "You" : member.isOnline ? "Online" : "Offline"}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-300 mb-2">{info.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">{member.displayName}</span>
                    <span className="text-sm font-medium">{member.score} pts</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {/* Empty slots */}
          {Array.from({ length: 4 - teamMembers.length }).map((_, index) => (
            <Card key={`empty-${index}`} className="bg-slate-700/30 border-slate-600 border-dashed">
              <CardContent className="p-3">
                <div className="text-center">
                  <p className="text-sm text-slate-400 mb-2">Waiting for player...</p>
                  <Button variant="ghost" size="sm" className="text-hint hover:underline">
                    Invite Friend
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Progress Tracker */}
      <Card className="glass-effect border-slate-600">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <TrendingUp className="progress-text mr-2" size={20} />
            Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Mystery Progress</span>
              <span>{playerProgress.cluesFound}/{playerProgress.totalClues} Clues</span>
            </div>
            <Progress 
              value={(playerProgress.cluesFound / playerProgress.totalClues) * 100} 
              className="h-2"
            />
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Vocabulary Learned</span>
              <span>{playerProgress.vocabularyLearned}/20 Words</span>
            </div>
            <Progress 
              value={(playerProgress.vocabularyLearned / 20) * 100} 
              className="h-2"
            />
          </div>

          <div className="text-center pt-2 border-t border-slate-600">
            <span className="text-2xl font-bold detective-text">{playerProgress.totalScore}</span>
            <p className="text-xs text-slate-400">Total Score</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

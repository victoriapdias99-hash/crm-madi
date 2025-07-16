import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Lock, Users, Search, HelpCircle, PenTool, Volume2, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Mystery {
  id: string;
  title: string;
  chapter: string;
  description: string;
  imageUrl: string;
  clues: Array<{
    id: string;
    title: string;
    description: string;
    requiredCharacter?: string;
    isUnlocked: boolean;
    requiresTeam?: boolean;
  }>;
  currentInvestigation?: string;
}

interface Vocabulary {
  word: string;
  translation: string;
  pronunciation?: string;
}

interface MainGameAreaProps {
  mystery: Mystery;
  vocabulary: Vocabulary[];
  onGameAction: (action: any) => void;
  playerCharacter?: any;
}

export default function MainGameArea({ mystery, vocabulary, onGameAction, playerCharacter }: MainGameAreaProps) {
  const [translation, setTranslation] = useState("");
  const { toast } = useToast();

  const handleUseAbility = () => {
    onGameAction({
      type: 'ability_used',
      actionType: 'ability_used',
      actionData: { characterType: playerCharacter?.characterType, ability: 'examine_clue' },
      pointsAwarded: 50
    });
    
    toast({
      title: "Detective ability activated!",
      description: "You discovered new information.",
    });
  };

  const handleExamineClue = (clueId: string) => {
    onGameAction({
      type: 'clue_examined',
      actionType: 'clue_discovered',
      actionData: { clueId },
      pointsAwarded: 25
    });
    
    toast({
      title: "Clue examined!",
      description: "New vocabulary discovered!",
    });
  };

  const handleTranslationCheck = () => {
    const isCorrect = translation.toLowerCase().includes("secret meeting will be at eight");
    
    onGameAction({
      type: 'translation_completed',
      actionType: 'translation_completed',
      actionData: { translation, isCorrect },
      pointsAwarded: isCorrect ? 25 : 5
    });
    
    toast({
      title: isCorrect ? "Correct translation!" : "Keep trying!",
      description: isCorrect ? "You earned 25 points!" : "You earned 5 points for the attempt.",
      variant: isCorrect ? "default" : "destructive"
    });
    
    if (isCorrect) {
      setTranslation("");
    }
  };

  const handlePronunciation = (word: string) => {
    toast({
      title: "Playing pronunciation",
      description: `Pronouncing: ${word}`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Mystery Scenario */}
      <Card className="glass-effect border-slate-600">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center">
              <span className="text-2xl mr-3">🎭</span>
              {mystery.title}
            </CardTitle>
            <Badge className="detective-bg">
              {mystery.chapter}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Mystery Image */}
          <img 
            src={mystery.imageUrl}
            alt="Mystery scene"
            className="w-full h-48 object-cover rounded-lg mb-4"
          />
          
          <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
            <p className="text-slate-200 leading-relaxed">
              {mystery.description}
            </p>
          </div>

          {/* Interactive Clues */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {mystery.clues.map((clue) => (
              <Card 
                key={clue.id}
                className={`cursor-pointer transition-colors ${
                  clue.isUnlocked 
                    ? 'bg-gradient-to-br from-amber-500/20 to-amber-500/10 border-amber-500/30 hover:border-amber-500/50' 
                    : 'bg-slate-700/30 border-slate-600 border-dashed'
                }`}
                onClick={() => clue.isUnlocked && handleExamineClue(clue.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center mb-2">
                    <span className="text-lg mr-2">📝</span>
                    <h4 className="font-semibold">{clue.title}</h4>
                    {clue.requiredCharacter && (
                      <Lock className={clue.isUnlocked ? "detective-text" : "text-slate-500"} size={16} className="ml-auto" />
                    )}
                    {clue.requiresTeam && (
                      <Users className="text-slate-500 ml-auto" size={16} />
                    )}
                  </div>
                  <p className="text-sm text-slate-300 mb-2">{clue.description}</p>
                  {clue.requiredCharacter && (
                    <Badge 
                      variant="outline" 
                      className={clue.isUnlocked ? "detective-text border-amber-500" : "text-slate-400 border-slate-600"}
                    >
                      {clue.isUnlocked ? `Available for ${clue.requiredCharacter}` : `Requires: ${clue.requiredCharacter}`}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Current Investigation */}
          {mystery.currentInvestigation && (
            <Card className="hint-bg/10 border-blue-500/30">
              <CardContent className="p-4">
                <h4 className="font-semibold hint-text mb-2 flex items-center">
                  <Search className="mr-2" size={16} />
                  Current Investigation
                </h4>
                <p className="text-sm text-slate-300 mb-3">
                  {mystery.currentInvestigation}
                </p>
                
                <div className="flex flex-wrap gap-2">
                  <Button 
                    onClick={handleUseAbility}
                    className="detective-bg hover:bg-amber-600"
                    size="sm"
                  >
                    <Search className="mr-1" size={16} />
                    Use Detective Skills
                  </Button>
                  <Button 
                    variant="outline"
                    className="border-blue-500 text-blue-400 hover:bg-blue-500/20"
                    size="sm"
                  >
                    <Users className="mr-1" size={16} />
                    Request Team Help
                  </Button>
                  <Button 
                    variant="outline"
                    className="border-slate-600 hover:bg-slate-700"
                    size="sm"
                  >
                    <PenTool className="mr-1" size={16} />
                    Take Notes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Language Learning Panel */}
      <Card className="glass-effect border-slate-600">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <span className="text-xl mr-2">🎓</span>
            Language Hints & Translation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vocabulary */}
            <div className="bg-slate-700/50 rounded-lg p-3">
              <h4 className="font-medium mb-2 hint-text">Vocabulary in This Scene</h4>
              <div className="space-y-2">
                {vocabulary.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="detective-text font-medium">{item.word}</span>
                    <span className="text-sm text-slate-300">{item.translation}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePronunciation(item.word)}
                      className="hint-text hover:bg-blue-500/20 p-1"
                    >
                      <Volume2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Translation Challenge */}
            <div className="bg-slate-700/50 rounded-lg p-3">
              <h4 className="font-medium mb-2 progress-text">Translation Challenge</h4>
              <div className="space-y-3">
                <p className="text-sm text-slate-300 italic">
                  "La reunión secreta será a las ocho"
                </p>
                <Input
                  value={translation}
                  onChange={(e) => setTranslation(e.target.value)}
                  placeholder="Type your translation..."
                  className="bg-slate-600 border-slate-500 text-white focus:border-blue-500"
                />
                <Button
                  onClick={handleTranslationCheck}
                  className="progress-bg hover:bg-emerald-600 w-full"
                  size="sm"
                >
                  <CheckCircle className="mr-1" size={16} />
                  Check Translation
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

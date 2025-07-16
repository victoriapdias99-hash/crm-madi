import { useState, useEffect } from "react";
import { getMysteryData, getVocabularyForMystery } from "@/lib/game-data";

interface GameUpdate {
  type: string;
  progress?: any;
  playerId?: number;
  message?: any;
}

export function useGameState(roomData: any, gameUpdates: GameUpdate[]) {
  const [currentMystery, setCurrentMystery] = useState<any>(null);
  const [vocabulary, setVocabulary] = useState<any[]>([]);
  const [playerProgress, setPlayerProgress] = useState({
    mysteryProgress: 0,
    vocabularyLearned: 0,
    totalScore: 0,
    cluesFound: 3,
    totalClues: 5
  });
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  useEffect(() => {
    if (roomData) {
      // Initialize mystery data
      const mystery = getMysteryData(roomData.mysteryId);
      setCurrentMystery(mystery);
      
      // Initialize vocabulary
      const vocab = getVocabularyForMystery(roomData.mysteryId, roomData.language);
      setVocabulary(vocab);
      
      // Initialize team members (including mock data for demo)
      const members = roomData.players?.map((player: any, index: number) => ({
        id: player.id,
        displayName: player.displayName,
        characterType: player.characterType,
        score: player.score,
        isOnline: player.isOnline,
        isCurrentPlayer: index === 0 // Mock: first player is current player
      })) || [];
      
      // Add mock team members for demo
      if (members.length === 0) {
        members.push({
          id: 1,
          displayName: "Alex_Detective",
          characterType: "detective",
          score: 245,
          isOnline: true,
          isCurrentPlayer: true
        });
      }
      
      if (members.length === 1) {
        members.push({
          id: 2,
          displayName: "Maria_Linguist",
          characterType: "linguist",
          score: 180,
          isOnline: true,
          isCurrentPlayer: false
        });
      }
      
      setTeamMembers(members);
      
      // Set initial progress
      setPlayerProgress(prev => ({
        ...prev,
        totalScore: members.find(m => m.isCurrentPlayer)?.score || 0,
        vocabularyLearned: 12
      }));
    }
  }, [roomData]);

  useEffect(() => {
    // Handle game updates
    gameUpdates.forEach(update => {
      switch (update.type) {
        case 'game_update':
          if (update.progress) {
            setPlayerProgress(prev => ({
              ...prev,
              totalScore: prev.totalScore + (update.progress.pointsAwarded || 0)
            }));
            
            if (update.progress.actionType === 'vocabulary_learned') {
              setPlayerProgress(prev => ({
                ...prev,
                vocabularyLearned: prev.vocabularyLearned + 1
              }));
            }
            
            if (update.progress.actionType === 'clue_discovered') {
              setPlayerProgress(prev => ({
                ...prev,
                cluesFound: Math.min(prev.cluesFound + 1, prev.totalClues)
              }));
            }
          }
          break;
          
        case 'player_joined':
        case 'player_left':
          // Handle team member changes
          // This would typically refetch the team data
          break;
      }
    });
  }, [gameUpdates]);

  return {
    currentMystery,
    vocabulary,
    playerProgress,
    teamMembers
  };
}

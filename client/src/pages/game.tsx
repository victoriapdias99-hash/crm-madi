import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import GameHeader from "@/components/game-header";
import CharacterPanel from "@/components/character-panel";
import MainGameArea from "@/components/main-game-area";
import CommunicationPanel from "@/components/communication-panel";
import { useWebSocket } from "@/hooks/use-websocket";
import { useGameState } from "@/hooks/use-game-state";
import { Skeleton } from "@/components/ui/skeleton";

export default function Game() {
  const { roomId } = useParams();
  const roomIdNum = parseInt(roomId || "0");
  
  const { data: roomData, isLoading } = useQuery({
    queryKey: ['/api/rooms', roomIdNum],
    enabled: !!roomIdNum,
  });

  const { 
    sendMessage, 
    sendGameAction, 
    isConnected,
    chatMessages,
    gameUpdates 
  } = useWebSocket(roomIdNum, 1); // Mock player ID

  const {
    currentMystery,
    vocabulary,
    playerProgress,
    teamMembers
  } = useGameState(roomData, gameUpdates);

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <GameHeader roomData={null} isConnected={false} />
        <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3">
            <Skeleton className="h-96 bg-slate-700" />
          </div>
          <div className="lg:col-span-6">
            <Skeleton className="h-96 bg-slate-700" />
          </div>
          <div className="lg:col-span-3">
            <Skeleton className="h-96 bg-slate-700" />
          </div>
        </div>
      </div>
    );
  }

  if (!roomData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Room Not Found</h1>
          <p className="text-slate-400">The game room you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <GameHeader roomData={roomData} isConnected={isConnected} />
      
      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-screen">
        <div className="lg:col-span-3">
          <CharacterPanel 
            teamMembers={teamMembers}
            playerProgress={playerProgress}
            currentPlayer={teamMembers.find(m => m.isCurrentPlayer)}
          />
        </div>
        
        <div className="lg:col-span-6">
          <MainGameArea 
            mystery={currentMystery}
            vocabulary={vocabulary}
            onGameAction={sendGameAction}
            playerCharacter={teamMembers.find(m => m.isCurrentPlayer)}
          />
        </div>
        
        <div className="lg:col-span-3">
          <CommunicationPanel 
            chatMessages={chatMessages}
            onSendMessage={sendMessage}
            onGameAction={sendGameAction}
            teamMembers={teamMembers}
          />
        </div>
      </div>
    </div>
  );
}

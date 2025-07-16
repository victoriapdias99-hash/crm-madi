import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Globe, Landmark, Play, UserPlus } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CHARACTER_TYPES, LANGUAGES, DIFFICULTY_LEVELS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const CHARACTER_INFO = {
  [CHARACTER_TYPES.DETECTIVE]: {
    name: "Detective",
    icon: Search,
    color: "detective-text",
    bgColor: "detective-bg",
    description: "Can analyze physical clues and interview witnesses",
    abilities: ["Examine evidence", "Interview suspects", "Unlock crime scenes"]
  },
  [CHARACTER_TYPES.LINGUIST]: {
    name: "Linguist",
    icon: Users,
    color: "text-blue-400",
    bgColor: "bg-blue-500",
    description: "Can decode language patterns and grammar clues",
    abilities: ["Analyze grammar", "Decode patterns", "Linguistic analysis"]
  },
  [CHARACTER_TYPES.TRANSLATOR]: {
    name: "Translator",
    icon: Globe,
    color: "text-green-400",
    bgColor: "bg-green-500",
    description: "Can translate documents and foreign phrases",
    abilities: ["Document translation", "Real-time interpretation", "Cultural context"]
  },
  [CHARACTER_TYPES.CULTURAL_EXPERT]: {
    name: "Cultural Expert",
    icon: Landmark,
    color: "text-purple-400",
    bgColor: "bg-purple-500",
    description: "Can interpret cultural references and context",
    abilities: ["Cultural analysis", "Historical context", "Social customs"]
  }
};

export default function CharacterSelect() {
  const [, setLocation] = useLocation();
  const [selectedCharacter, setSelectedCharacter] = useState<string>("");
  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState("spanish");
  const [difficulty, setDifficulty] = useState("beginner");
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [roomName, setRoomName] = useState("");
  const { toast } = useToast();

  const { data: rooms = [], refetch: refetchRooms } = useQuery({
    queryKey: ['/api/rooms'],
  });

  const createRoomMutation = useMutation({
    mutationFn: async (data: { name: string; language: string; difficultyLevel: string; mysteryId: string }) => {
      const response = await apiRequest('POST', '/api/rooms', data);
      return response.json();
    },
    onSuccess: (room) => {
      queryClient.invalidateQueries({ queryKey: ['/api/rooms'] });
      joinGame(room.id);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create room",
        variant: "destructive"
      });
    }
  });

  const joinRoomMutation = useMutation({
    mutationFn: async (data: { userId: number; roomId: number; characterType: string; displayName: string }) => {
      const response = await apiRequest('POST', '/api/players', data);
      return response.json();
    },
    onSuccess: (player) => {
      setLocation(`/game/${player.roomId}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to join room",
        variant: "destructive"
      });
    }
  });

  const handleCreateRoom = () => {
    if (!roomName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a room name",
        variant: "destructive"
      });
      return;
    }

    createRoomMutation.mutate({
      name: roomName,
      language,
      difficultyLevel: difficulty,
      mysteryId: "missing_manuscript"
    });
  };

  const joinGame = (roomId: number) => {
    if (!selectedCharacter || !displayName.trim()) {
      toast({
        title: "Error",
        description: "Please select a character and enter a display name",
        variant: "destructive"
      });
      return;
    }

    joinRoomMutation.mutate({
      userId: 1, // Mock user ID for now
      roomId,
      characterType: selectedCharacter,
      displayName
    });
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 flex items-center justify-center gap-3">
            <Search className="detective-text" size={48} />
            Mystery Language Quest
          </h1>
          <p className="text-slate-300 text-lg">
            Choose your character and start solving mysteries while learning languages!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Character Selection */}
          <div className="space-y-6">
            <Card className="glass-effect border-slate-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="detective-text" size={24} />
                  Choose Your Character
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="displayName" className="text-slate-200">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your display name"
                    className="mt-2 bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                <div>
                  <Label className="text-slate-200">Select Character</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    {Object.entries(CHARACTER_INFO).map(([type, info]) => {
                      const Icon = info.icon;
                      const isSelected = selectedCharacter === type;
                      
                      return (
                        <Card
                          key={type}
                          className={`cursor-pointer transition-all hover:scale-105 ${
                            isSelected 
                              ? 'ring-2 ring-amber-500 bg-amber-500/20' 
                              : 'glass-effect border-slate-600 hover:border-slate-500'
                          }`}
                          onClick={() => setSelectedCharacter(type)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3 mb-2">
                              <Icon className={info.color} size={24} />
                              <span className={`font-semibold ${info.color}`}>{info.name}</span>
                            </div>
                            <p className="text-sm text-slate-300 mb-3">{info.description}</p>
                            <div className="space-y-1">
                              {info.abilities.map((ability, index) => (
                                <Badge key={index} variant="secondary" className="text-xs mr-1">
                                  {ability}
                                </Badge>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-200">Learning Language</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="mt-2 bg-slate-700 border-slate-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="spanish">Spanish</SelectItem>
                        <SelectItem value="french">French</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-slate-200">Difficulty</Label>
                    <Select value={difficulty} onValueChange={setDifficulty}>
                      <SelectTrigger className="mt-2 bg-slate-700 border-slate-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Room Selection */}
          <div className="space-y-6">
            {!showCreateRoom ? (
              <Card className="glass-effect border-slate-600">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Play className="hint-text" size={24} />
                    Join Existing Game
                  </CardTitle>
                  <Button
                    onClick={() => setShowCreateRoom(true)}
                    variant="outline"
                    className="border-slate-600 hover:bg-slate-700"
                  >
                    Create New Room
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {rooms.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <p>No active rooms found</p>
                      <p className="text-sm">Create a new room to start playing!</p>
                    </div>
                  ) : (
                    rooms.map((room: any) => (
                      <Card key={room.id} className="bg-slate-700/50 border-slate-600">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-semibold text-white">{room.name}</h3>
                              <div className="flex items-center gap-4 mt-1">
                                <span className="text-sm text-slate-400">
                                  {room.currentPlayers}/{room.maxPlayers} players
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  {room.language}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {room.difficultyLevel}
                                </Badge>
                              </div>
                            </div>
                            <Button
                              onClick={() => joinGame(room.id)}
                              disabled={room.currentPlayers >= room.maxPlayers || joinRoomMutation.isPending}
                              className="detective-bg hover:bg-amber-600"
                            >
                              Join
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="glass-effect border-slate-600">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="progress-text" size={24} />
                    Create New Room
                  </CardTitle>
                  <Button
                    onClick={() => setShowCreateRoom(false)}
                    variant="ghost"
                    className="text-slate-400 hover:text-white"
                  >
                    Back
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="roomName" className="text-slate-200">Room Name</Label>
                    <Input
                      id="roomName"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="Enter room name"
                      className="mt-2 bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  
                  <Button
                    onClick={handleCreateRoom}
                    disabled={createRoomMutation.isPending}
                    className="w-full progress-bg hover:bg-emerald-600"
                  >
                    {createRoomMutation.isPending ? "Creating..." : "Create & Join Room"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

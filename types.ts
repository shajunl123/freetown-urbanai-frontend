export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  isThinking?: boolean;
  groundingChunks?: GroundingChunk[];
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
}

export interface FreetownStats {
  population: string;
  area: string;
  wards: number;
  activeProjects: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  status: 'online' | 'busy' | 'offline';
  initials: string;
}

export interface WeatherData {
  temp: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  aqi: number;
}

export interface UploadedDoc {
  id: string;
  name: string;
  type: string;
  size: string;
  progress: number;
}
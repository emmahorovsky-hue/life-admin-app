export interface User {
  id: string;
  email: string;
  name: string | null;
  surname: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  reminderEmailsEnabled: boolean;
  reminderPushEnabled: boolean;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  message: string;
  user: User;
}

export interface ErrorResponse {
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

declare global {
  namespace Express {
    interface Request {
      id?: string;
      user: {
        id: string;
        email: string;
        role: string;
        roleId?: string;
        siteId?: string | null;
        siteIds?: string[];
        permissions?: string[];
      };
      apiKey?: {
        id: string;
        name: string;
        prefix: string;
        permissions?: string[];
      };
    }
  }
}

export {};

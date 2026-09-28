/// <reference types="astro/client" />

type SessionUser = import('better-auth').User & { twoFactorEnabled?: boolean | null };

declare namespace App {
  interface Locals {
    user: SessionUser | null;
    session: import('better-auth').Session | null;
  }
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";

export default function Nav() {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();

  const linkClass = (href: string) =>
    `text-sm font-medium transition-colors ${
      pathname === href
        ? "text-accent"
        : "text-muted hover:text-foreground"
    }`;

  return (
    <nav className="border-b border-border bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-bold tracking-tight">
            TypeSet
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/" className={linkClass("/")}>
              Browse
            </Link>
            {isSignedIn && (
              <>
                <Link href="/library" className={linkClass("/library")}>
                  Library
                </Link>
                <Link href="/collections" className={linkClass("/collections")}>
                  Collections
                </Link>
              </>
            )}
          </div>
        </div>
        <div>
          {isSignedIn ? (
            <UserButton />
          ) : (
            <SignInButton mode="modal">
              <button className="text-sm font-medium text-white bg-accent hover:bg-accent/90 px-4 py-2 rounded-lg transition-colors cursor-pointer">
                Sign In
              </button>
            </SignInButton>
          )}
        </div>
      </div>
    </nav>
  );
}

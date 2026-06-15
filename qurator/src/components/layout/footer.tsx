'use client';

import { QuratorLogo } from '@/components/layout/qurator-logo';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith('/create/')) return null;

  return (
    <footer className="border-t border-border py-12 px-6">
      <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <QuratorLogo size={20} />
          <span className="font-semibold text-foreground text-sm">
            Qurator
          </span>
        </div>
        <ul className="flex gap-6 list-none flex-wrap justify-center">
          <li>
            <Link
              href="/tutorials"
              className="text-foreground-muted text-sm hover:text-foreground transition-colors"
            >
              Browse
            </Link>
          </li>
          <li>
            <Link
              href="/create"
              className="text-foreground-muted text-sm hover:text-foreground transition-colors"
            >
              Create
            </Link>
          </li>
          <li>
            <a
              href="https://www.quobby.com/support"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground-muted text-sm hover:text-foreground transition-colors"
            >
              FAQ &amp; Support
            </a>
          </li>
          <li>
            <a
              href="https://www.quobby.com"
              target="_blank"
              rel="noopener"
              className="text-foreground-muted text-sm hover:text-foreground transition-colors"
            >
              Quobby App
            </a>
          </li>
          <li>
            <a
              href="https://www.quobby.com/privacy"
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-foreground-muted text-sm hover:text-foreground transition-colors"
            >
              Privacy
            </a>
          </li>
          <li>
            <a
              href="https://www.quobby.com/terms"
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-foreground-muted text-sm hover:text-foreground transition-colors"
            >
              Terms
            </a>
          </li>
        </ul>
      </div>
      <div className="max-w-[1100px] mx-auto mt-6 pt-6 border-t border-border text-center text-xs text-foreground-faint">
        &copy; {new Date().getFullYear()} Quobby. All rights reserved.
      </div>
    </footer>
  );
}

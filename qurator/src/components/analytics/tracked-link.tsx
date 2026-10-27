'use client';

import { track } from '@vercel/analytics';
import Link from 'next/link';
import type { AnchorHTMLAttributes, MouseEventHandler, ReactNode } from 'react';

type EventProperties = Record<string, string | number | boolean | null>;

interface TrackedLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  eventName: string;
  eventProperties?: EventProperties;
  children: ReactNode;
}

export function TrackedLink({
  href,
  eventName,
  eventProperties,
  onClick,
  children,
  ...props
}: TrackedLinkProps) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    track(eventName, eventProperties);
    onClick?.(event);
  };

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}

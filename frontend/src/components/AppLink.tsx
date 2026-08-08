/**
 * Drop-in replacement for next/link that automatically applies the
 * deploy-time base path (e.g. /proxy/8080 on Poridhi).
 *
 * Usage: swap  `import Link from 'next/link'`
 *   with `import Link from '@/components/AppLink'`
 */
import NextLink from 'next/link';
import type { ComponentProps } from 'react';

import { prefixHref } from '../lib/basePath';

type LinkProps = ComponentProps<typeof NextLink>;

export default function Link({ href, ...props }: LinkProps) {
  const prefixed = typeof href === 'string' ? prefixHref(href) : href;
  return <NextLink href={prefixed} {...props} />;
}

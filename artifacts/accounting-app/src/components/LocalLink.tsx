import type { AnchorHTMLAttributes, PropsWithChildren } from "react";

export default function LocalLink({ href, children, ...props }: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>) {
  return <a href={href} {...props}>{children}</a>;
}

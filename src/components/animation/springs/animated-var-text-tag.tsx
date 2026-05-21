// 📖 Docs: obsidian/frontend/components/animation-springs.md
import { Tags } from "@/types/springs";
import { animated, ElementType } from "@react-spring/web";
import {
  CSSProperties,
  forwardRef,
  ReactNode,
  useImperativeHandle,
  useRef,
} from "react";

export interface VarTextTagProps {
  tag?: Tags;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}
export const AnimatedVarTextTag = forwardRef<HTMLElement, VarTextTagProps>(
  ({ tag = "span", children, className, style, ...props }, outerRef) => {
    const ref = useRef<HTMLElement | null>(null);
    useImperativeHandle(outerRef, () => ref.current as HTMLElement);
    const Tag = animated[tag] as ElementType;

    return (
      <Tag ref={ref} className={className} style={style} {...props}>
        {children}
      </Tag>
    );
  },
);
AnimatedVarTextTag.displayName = "AnimatedVarTextTag";

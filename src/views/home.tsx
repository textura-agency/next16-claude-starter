"use client";

import { useRef } from "react";
import { easings } from "@react-spring/web";
import TextEngine from "spring-text-engine";
import { Hover } from "@/components/animation/springs/hover";
import { SpringTrigger } from "@/components/animation/springs/spring-trigger";

export const HomeView = () => {
  const trigger = useRef<HTMLDivElement>(null);

  return (
    <div className="z-1 w-screen min-h-[200lvh] flex flex-col items-center justify-center gap-50 bg-white text-black">
      <SpringTrigger
        tag="h1"
        from={{ y: "0rem" }}
        to={{ y: "10rem" }}
        onChange={() => {
          console.log("onChange");
        }}
      >
        Hello World!
      </SpringTrigger>

      <TextEngine
        tag="h1"
        mode="once"
        lineIn={{ y: "0%", opacity: 1 }}
        lineOut={{ y: "100%", opacity: 0 }}
        lineStagger={100}
        lineConfig={{ duration: 900, easing: easings.easeOutCubic }}
        overflow
      >
        Hover Me!
      </TextEngine>

      <Hover
        className="h-2.5 w-full bg-black fixed bottom-16 left-0"
        tag="div"
        trigger={trigger}
        from={{ maxWidth: "0%" }}
        to={{ maxWidth: "100%" }}
      />

      <TextEngine
        tag="h2"
        mode="progress"
        type="interpolate"
        interpolationStaggerCoefficient={0.5}
        letterIn={{ opacity: 1 }}
        letterOut={{ opacity: 0.1 }}
        wordIn={{ y: 0 }}
        wordOut={{ y: 50 }}
      >
        Yooooo that is a nice progress text with interpolation!
      </TextEngine>

      <TextEngine
        tag="h2"
        mode="progress"
        type="toggle"
        letterIn={{ opacity: 1 }}
        letterOut={{ opacity: 0.1 }}
        wordIn={{ y: 0 }}
        wordOut={{ y: 10 }}
      >
        Yooooo that is a nice progress text!
      </TextEngine>
    </div>
  );
};

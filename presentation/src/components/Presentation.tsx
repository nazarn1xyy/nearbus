"use client";

import React, { useState, useEffect } from "react";
import { motion, useMotionValue, useTransform, useSpring, animate, useMotionValueEvent } from "framer-motion";
import { Pause, Play, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import QRCode from "react-qr-code";

export default function Presentation() {
  const time = useMotionValue(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [typedChars, setTypedChars] = useState(0);
  const TOTAL_TIME = 25; // Adrenaline 25-second rush

  useEffect(() => {
    let controls: any;
    if (isPlaying) {
      const remaining = TOTAL_TIME - time.get();
      if (remaining > 0) {
        controls = animate(time, TOTAL_TIME, {
          duration: remaining * 1.5, // 1.5x slower pacing (37.5s total real time)
          ease: "linear",
          onComplete: () => setIsPlaying(false),
        });
      }
    }
    return () => controls?.stop();
  }, [isPlaying, time]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === "ArrowRight") {
        time.set(Math.min(time.get() + 2, TOTAL_TIME));
      } else if (e.code === "ArrowLeft") {
        time.set(Math.max(time.get() - 2, 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [time]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const skipForward = () => time.set(Math.min(time.get() + 2, TOTAL_TIME));
  const skipBackward = () => time.set(Math.max(time.get() - 2, 0));

  // --- APPLE PROMO PHYSICS (Ultra-fast, aggressive snapping) ---
  const stompSpring = { stiffness: 400, damping: 25 };
  const hardwareSpring = { stiffness: 150, damping: 20 };

  // --- TIMELINE MAPPINGS (0 to 25 seconds) ---

  const progressWidth = useTransform(time, [0, TOTAL_TIME], ["0%", "100%"]);

  // 1. Intro (0-3s)
  const introScaleRaw = useTransform(time, [0, 2.5, 3], [1, 1, 30]);
  const introScale = useSpring(introScaleRaw, stompSpring);
  const introOpacityRaw = useTransform(time, [0, 2.5, 2.8], [1, 1, 0]);
  const introOpacity = useSpring(introOpacityRaw, stompSpring);
  const introBlur = useTransform(time, [0, 2.5, 3], ["blur(0px)", "blur(0px)", "blur(50px)"]);

  // Telegram Bot Typing Tracking Effect (15.8 to 17.0s)
  const botTypingText = "Telegram Бот.";
  const botTypingStart = 15.8;
  const botTypingEnd = 17.0;
  
  useMotionValueEvent(time, "change", (latest) => {
    if (latest >= botTypingStart && latest <= botTypingEnd) {
      const progress = (latest - botTypingStart) / (botTypingEnd - botTypingStart);
      setTypedChars(Math.round(progress * botTypingText.length));
    } else if (latest < botTypingStart) {
      setTypedChars(0);
    } else if (latest > botTypingEnd) {
      setTypedChars(botTypingText.length);
    }
  });

  // While typing (15.8-17.0), x is -100% so the right edge (cursor) stays at 50%.
  // After typing (17.0-17.3), x animates to 0% so it left-aligns perfectly with the paragraph!
  const botCenteringXRaw = useTransform(time, [15.8, 17.0, 17.01, 17.3], ["-100%", "-100%", "-100%", "0%"]);
  const botCenteringX = useSpring(botCenteringXRaw, hardwareSpring);

  // 2. Problem (2.5-5.5s) - Staggered Kinetic Text
  const prob1ScaleRaw = useTransform(time, [2.5, 2.7, 5, 5.3], [5, 1, 1, 0]);
  const prob1Scale = useSpring(prob1ScaleRaw, stompSpring);
  const prob1Opacity = useTransform(time, [2.5, 2.6, 5, 5.1], [0, 1, 1, 0]);
  
  const prob2ScaleRaw = useTransform(time, [2.7, 2.9, 5, 5.3], [5, 1, 1, 0]);
  const prob2Scale = useSpring(prob2ScaleRaw, stompSpring);
  const prob2Opacity = useTransform(time, [2.7, 2.8, 5, 5.1], [0, 1, 1, 0]);
  
  const prob3ScaleRaw = useTransform(time, [2.9, 3.1, 5, 5.3], [5, 1, 1, 0]);
  const prob3Scale = useSpring(prob3ScaleRaw, stompSpring);
  const prob3Opacity = useTransform(time, [2.9, 3.0, 5, 5.1], [0, 1, 1, 0]);
  const probBlur = useTransform(time, [2.5, 2.8, 5, 5.3], ["blur(30px)", "blur(0px)", "blur(0px)", "blur(20px)"]);

  // 3. MacBook (5-11s)
  const macYRaw = useTransform(time, [5, 5.4, 9, 10], ["100vh", "0vh", "0vh", "0vh"]);
  const macY = useSpring(macYRaw, hardwareSpring);
  const macRotateYRaw = useTransform(time, [5, 5.4, 9, 10], [90, 0, 0, 0]); 
  const macRotateY = useSpring(macRotateYRaw, hardwareSpring);
  const macScaleRaw = useTransform(time, [5, 5.4, 9, 9.5], [0.5, 1, 1, 0.5]); 
  const macScale = useSpring(macScaleRaw, hardwareSpring);
  const macOpacityRaw = useTransform(time, [5, 5.2, 9, 9.3], [0, 1, 1, 0]);
  const macOpacity = useSpring(macOpacityRaw, stompSpring);
  const macBlur = useTransform(time, [5, 5.4, 9, 9.5], ["blur(30px)", "blur(0px)", "blur(0px)", "blur(40px)"]);

  const macTextScaleRaw = useTransform(time, [5, 5.3, 8.5, 9], [3, 1, 1, 0.5]);
  const macTextScale = useSpring(macTextScaleRaw, stompSpring);
  const macTextOpacityRaw = useTransform(time, [5, 5.1, 8.5, 8.8], [0, 1, 1, 0]);
  const macTextOpacity = useSpring(macTextOpacityRaw, stompSpring);

  // 4. Map iPad (9.5-16s)
  const mapScaleRaw = useTransform(time, [9.5, 10, 15, 15.5], [3, 1, 1, 0.5]);
  const mapScale = useSpring(mapScaleRaw, hardwareSpring);
  const mapOpacityRaw = useTransform(time, [9.5, 9.8, 15, 15.2], [0, 1, 1, 0]);
  const mapOpacity = useSpring(mapOpacityRaw, stompSpring);
  const mapXRaw = useTransform(time, [15, 15.5], ["0vw", "100vw"]);
  const mapX = useSpring(mapXRaw, hardwareSpring);
  const mapRotateZRaw = useTransform(time, [15, 15.5], [0, 45]);
  const mapRotateZ = useSpring(mapRotateZRaw, hardwareSpring);

  const mapTextScaleRaw = useTransform(time, [9.8, 10.1, 14.5, 14.8], [3, 1, 1, 0.5]);
  const mapTextScale = useSpring(mapTextScaleRaw, stompSpring);
  const mapTextOpacityRaw = useTransform(time, [9.8, 9.9, 14.5, 14.6], [0, 1, 1, 0]);
  const mapTextOpacity = useSpring(mapTextOpacityRaw, stompSpring);

  // 5. Bot (15.5-20s)
  const botScaleRaw = useTransform(time, [15.5, 16, 19, 19.5], [3, 1, 1, 0.5]);
  const botScale = useSpring(botScaleRaw, hardwareSpring);
  const botOpacityRaw = useTransform(time, [15.5, 15.8, 19, 19.3], [0, 1, 1, 0]);
  const botOpacity = useSpring(botOpacityRaw, stompSpring);
  const botBlur = useTransform(time, [15.5, 16, 19, 19.5], ["blur(30px)", "blur(0px)", "blur(0px)", "blur(40px)"]);

  const botTextScaleRaw = useTransform(time, [15.8, 16.1, 18.5, 18.8], [3, 1, 1, 0.5]);
  const botTextScale = useSpring(botTextScaleRaw, stompSpring);
  const botTextOpacityRaw = useTransform(time, [15.8, 15.9, 18.5, 18.6], [0, 1, 1, 0]);
  const botTextOpacity = useSpring(botTextOpacityRaw, stompSpring);

  // 6. PWA (19.5-23s)
  const pwaYRaw = useTransform(time, [19.5, 20, 22.5, 23], ["100vh", "0vh", "0vh", "0vh"]);
  const pwaY = useSpring(pwaYRaw, hardwareSpring);
  const pwaScaleRaw = useTransform(time, [19.5, 20, 22.5, 23], [0.5, 1, 1, 0]);
  const pwaScale = useSpring(pwaScaleRaw, hardwareSpring);
  const pwaOpacityRaw = useTransform(time, [19.5, 19.7, 22.5, 22.7], [0, 1, 1, 0]);
  const pwaOpacity = useSpring(pwaOpacityRaw, stompSpring);

  const pwaTextScaleRaw = useTransform(time, [19.8, 20.1, 22.5, 22.8], [3, 1, 1, 0]);
  const pwaTextScale = useSpring(pwaTextScaleRaw, stompSpring);
  const pwaTextOpacityRaw = useTransform(time, [19.8, 19.9, 22.5, 22.6], [0, 1, 1, 0]);
  const pwaTextOpacity = useSpring(pwaTextOpacityRaw, stompSpring);

  // 7. Outro (22.5-25s)
  const outroScaleRaw = useTransform(time, [22.5, 23], [15, 1]);
  const outroScale = useSpring(outroScaleRaw, stompSpring);
  const outroOpacityRaw = useTransform(time, [22.5, 22.7], [0, 1]);
  const outroOpacity = useSpring(outroOpacityRaw, stompSpring);

  return (
    <div className="relative w-full h-screen overflow-hidden font-sans text-white perspective-[2000px]" style={{ backgroundImage: "radial-gradient(circle at 50% 50%, #1c1c1e 0%, #000000 80%)" }}>
      
      {/* 1. INTRO */}
      <motion.div 
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        style={{ scale: introScale, opacity: introOpacity, filter: introBlur, willChange: "transform, opacity, filter" }}
      >
        <div className="mb-8 relative w-48 h-48 drop-shadow-[0_0_80px_rgba(255,255,255,0.4)]">
          <Image src="/mockups/logo.png" alt="Logo" fill className="object-contain" />
        </div>
        <h1 className="text-[12vw] font-black tracking-tighter leading-none">
          Nearbus
        </h1>
        <p className="text-4xl text-gray-400 font-medium tracking-tight mt-6">
          Транспорт без стресу.
        </p>
      </motion.div>

      {/* 2. PROBLEM (STAGGERED KINETIC TEXT) */}
      <motion.div 
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        style={{ filter: probBlur, willChange: "filter" }}
      >
        <div className="text-[7vw] font-bold leading-tight tracking-tighter text-center">
          <motion.div style={{ scale: prob1Scale, opacity: prob1Opacity }}>
            Скільки ще чекати
          </motion.div>
          <motion.div style={{ scale: prob2Scale, opacity: prob2Opacity }}>
            на зупинці?
          </motion.div>
        </div>
        <motion.p 
          style={{ scale: prob3Scale, opacity: prob3Opacity }}
          className="text-4xl text-white mt-8 font-medium"
        >
          Паперові розклади застаріли.
        </motion.p>
      </motion.div>

      {/* 3. SOLUTION (MacBook) */}
      <motion.div className="absolute inset-0 flex flex-col items-center justify-center px-20 pointer-events-none overflow-hidden">
        <motion.div 
          className="text-center mb-8 relative z-20"
          style={{ scale: macTextScale, opacity: macTextOpacity, willChange: "transform, opacity" }}
        >
          <h3 className="text-[6vw] font-bold tracking-tighter leading-none">Живий розклад.</h3>
          <p className="text-3xl text-gray-400 font-medium mt-4">Час прибуття в реальному часі, з урахуванням заторів.</p>
        </motion.div>

        <motion.div
          className="relative w-[90vw] h-[60vh] z-10 perspective-1000"
          style={{ y: macY, rotateY: macRotateY, scale: macScale, opacity: macOpacity, filter: macBlur, willChange: "transform, opacity, filter" }}
        >
          <div className="w-full h-full relative">
            <Image src="/mockups/Screenshot 2026-07-02 at 12.39.14 1-front 1.png" alt="Macbook" fill className="object-contain" priority />
          </div>
        </motion.div>
      </motion.div>

      {/* 4. MAP (iPad) */}
      <motion.div 
        className="absolute inset-0 flex flex-col items-center justify-center px-20 pointer-events-none overflow-hidden"
        style={{ x: mapX, scale: mapScale, opacity: mapOpacity, rotateZ: mapRotateZ, willChange: "transform, opacity" }}
      >
        <motion.div className="text-center mb-8 z-20" style={{ scale: mapTextScale, opacity: mapTextOpacity, willChange: "transform, opacity" }}>
          <h3 className="text-[6vw] font-bold tracking-tighter leading-none">Інтерактивна Карта.</h3>
          <p className="text-3xl text-gray-400 font-medium mt-4">Весь транспорт міста як на долоні.</p>
        </motion.div>
        
        <div className="relative w-[80vw] h-[60vh] z-10 perspective-1000">
          <div className="w-full h-full relative">
            <Image src="/mockups/Screenshot 2026-07-02 at 12.39.38 1-front 1.png" alt="Map" fill className="object-contain drop-shadow-2xl" />
          </div>
        </div>
      </motion.div>

      {/* 5. TELEGRAM BOT */}
      <motion.div 
        className="absolute inset-0 flex items-center justify-center px-32 pointer-events-none overflow-hidden"
        style={{ scale: botScale, opacity: botOpacity, filter: botBlur, willChange: "transform, opacity, filter" }}
      >
        <motion.div className="w-1/2 text-left z-20 pr-12 relative" style={{ scale: botTextScale, opacity: botTextOpacity, willChange: "transform, opacity" }}>
          
          <div className="relative w-full h-[6vw] mb-6">
            <motion.div 
              className="absolute left-[30%] flex items-center whitespace-nowrap"
              style={{ x: botCenteringX, willChange: "transform" }}
            >
              <h3 className="text-[5vw] font-bold tracking-tighter leading-tight text-white">
                {botTypingText.substring(0, typedChars)}
              </h3>
              <motion.div 
                animate={{ opacity: [1, 0, 1] }} 
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                className="w-[1vw] h-[5vw] bg-white ml-2 rounded-sm"
              />
            </motion.div>
          </div>

          <p className="text-3xl text-gray-400 font-medium">Миттєві сповіщення про зміну графіку прямо у ваш месенджер.</p>
        </motion.div>
        
        <div className="w-1/2 flex justify-center z-10">
          <div className="relative w-[40vw] h-[80vh] perspective-1000">
            <div className="w-full h-full relative">
              <Image src="/mockups/Group 10.png" alt="Bot" fill className="object-contain" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* 6. PWA */}
      <motion.div 
        className="absolute inset-0 flex flex-col items-center justify-center px-20 pointer-events-none overflow-hidden"
        style={{ y: pwaY, scale: pwaScale, opacity: pwaOpacity, willChange: "transform, opacity" }}
      >
        <motion.div className="text-center mb-6 z-20 max-w-4xl mx-auto" style={{ scale: pwaTextScale, opacity: pwaTextOpacity, willChange: "transform, opacity" }}>
          <h3 className="text-5xl md:text-7xl lg:text-[5vw] font-bold tracking-tighter leading-tight mb-2 text-white">Завжди з вами.</h3>
          <p className="text-xl md:text-3xl text-gray-400 font-medium leading-relaxed">
            Працює як нативний додаток навіть без інтернету.<br />Встановлюється в один клік.
          </p>
        </motion.div>
        
        <div className="relative w-[50vw] h-[50vh] z-10 perspective-1000">
          <div className="w-full h-full relative">
            <Image src="/mockups/Group 6.png" alt="PWA" fill className="object-contain" />
          </div>
        </div>
      </motion.div>

      {/* 7. OUTRO */}
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10"
        style={{ scale: outroScale, opacity: outroOpacity, willChange: "transform, opacity" }}
      >
        <h2 className="text-[8vw] font-black tracking-tighter leading-none text-white mb-4">
          Спробуйте зараз.
        </h2>
        <p className="text-4xl text-gray-500 font-medium tracking-wide mb-16">
          nearbus.online
        </p>
        
        <div className="flex items-center gap-10 bg-white/5 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-[0_0_100px_rgba(255,255,255,0.1)]">
          <div className="bg-white p-4 rounded-2xl pointer-events-auto">
            <QRCode value="https://nearbus.online" size={180} />
          </div>
          <div className="flex flex-col items-start justify-center w-48">
            <div className="w-24 h-24 relative mb-6">
              <Image src="/mockups/logo.png" alt="Logo" fill className="object-contain" />
            </div>
            <p className="text-lg text-gray-400 font-medium leading-tight">
              Наведіть камеру, щоб відкрити додаток.
            </p>
          </div>
        </div>
      </motion.div>

      {/* MINIMALIST HUD */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50 transition-opacity duration-500 opacity-0 hover:opacity-100 pointer-events-auto">
        <button onClick={skipBackward} className="text-gray-500 hover:text-white transition">
          <ChevronLeft size={24} />
        </button>
        <button onClick={togglePlay} className="text-gray-500 hover:text-white transition">
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>
        <button onClick={skipForward} className="text-gray-500 hover:text-white transition">
          <ChevronRight size={24} />
        </button>
        <div className="w-64 h-[2px] bg-[#333] overflow-hidden relative rounded">
          <motion.div
            className="absolute left-0 top-0 bottom-0 bg-white"
            style={{ width: progressWidth }}
          />
        </div>
      </div>
    </div>
  );
}

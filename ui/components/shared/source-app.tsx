import React from "react";
import { BiEdit } from "react-icons/bi";
import Image from "next/image";
import { FaRobot } from "react-icons/fa"; // 添加机器人图标

export const Icon = ({ source }: { source: string }) => {
  return (
    <div className="w-5 h-5 rounded-full bg-transparent flex items-center justify-center overflow-hidden -mr-1">
      <Image src={source} alt={source} width={40} height={40} priority />
    </div>
  );
};

const BrandIcon = () => {
  return (
    <div
      className="w-5 h-5 -mr-1 text-foreground"
      style={{
        backgroundColor: "currentColor",
        WebkitMaskImage: "url(/logo-s.svg)",
        maskImage: "url(/logo-s.svg)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
};

export const constants = {
  claude: {
    name: "Claude",
    icon: <Icon source="/images/claude.webp" />,
    iconImage: "/images/claude.webp",
  },
  openmemory: {
    name: "MoMemory",
    icon: <BrandIcon />,
    iconImage: "",
  },
  MoMemory: {
    name: "MoMemory",
    icon: <BrandIcon />,
    iconImage: "",
  },
  cursor: {
    name: "Cursor",
    icon: <Icon source="/images/cursor.png" />,
    iconImage: "/images/cursor.png",
  },
  cline: {
    name: "Cline",
    icon: <Icon source="/images/cline.png" />,
    iconImage: "/images/cline.png",
  },
  roocline: {
    name: "Roo Cline",
    icon: <Icon source="/images/roocline.png" />,
    iconImage: "/images/roocline.png",
  },
  windsurf: {
    name: "Windsurf",
    icon: <Icon source="/images/windsurf.png" />,
    iconImage: "/images/windsurf.png",
  },
  witsy: {
    name: "Witsy",
    icon: <Icon source="/images/witsy.png" />,
    iconImage: "/images/witsy.png",
  },
  enconvo: {
    name: "Enconvo",
    icon: <Icon source="/images/enconvo.png" />,
    iconImage: "/images/enconvo.png",
  },
  // 为MoMemory-test1111应用添加logo-s.svg图标
  "MoMemory-test1111": {
    name: "MoMemory-test1111",
    icon: <Icon source="/logo-s.svg" />,
    iconImage: "/logo-s.svg",
  },
  // 为所有包含MoMemory-的应用添加logo-s.svg图标
  "MoMemory-": {
    name: "MoMemory",
    icon: <Icon source="/logo-s.svg" />,
    iconImage: "/logo-s.svg",
  },
  default: {
    name: "Default",
    icon: <BiEdit size={20} className="ml-1" />,
    iconImage: "/images/default.png",
  },
};

const SourceApp = ({ source }: { source: string }) => {
  const cfg = getAppConfig(source);
  return (
    <div className="flex items-center gap-2">
      {cfg.iconImage ? (
        <Image src={cfg.iconImage} alt={cfg.name} width={20} height={20} />
      ) : (
        <span className="inline-flex items-center justify-center w-5 h-5">
          {cfg.icon}
        </span>
      )}
      <span className="text-sm font-semibold">{cfg.name}</span>
    </div>
  );
};

export default SourceApp;

// 统一的应用图标解析函数，供各组件复用
export const getAppConfig = (appName: string) => {
  // 预定义映射优先
  if (constants[appName as keyof typeof constants]) {
    return constants[appName as keyof typeof constants];
  }

  // 尝试小写匹配
  const lowerName = appName.toLowerCase();
  if (constants[lowerName as keyof typeof constants]) {
    return constants[lowerName as keyof typeof constants];
  }

  // MoMemory 品牌/用户应用统一使用品牌 SVG（主题自适配）
  if (appName === "MoMemory" || appName === "openmemory" || appName.includes("MoMemory-")) {
    return { name: appName, icon: <Icon source="/logo-s.svg" />, iconImage: "" };
  }

  // MAC 地址 / WebSocket / 关键词命中的 AI 设备/应用 → 机器人图标
  const isMac = appName.match(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/);
  const lower = appName.toLowerCase();
  const isWs = appName.startsWith("ws://") || appName.startsWith("wss://");
  const isRobotKw = lower.includes("mcphub") || lower.includes("xiaozhi") || lower.includes("ai") || lower.includes("bot") || appName.includes("机器人") || appName.includes("婷") || appName.includes("小智");
  if (isMac || isWs || isRobotKw) {
    return { name: appName, icon: <FaRobot className="w-4 h-4 text-foreground" />, iconImage: "" };
  }

  // 默认
  return constants.default;
};

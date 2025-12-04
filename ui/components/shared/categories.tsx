"use client";
import React from "react";
import {
  Book,
  HeartPulse,
  BriefcaseBusiness,
  CircleHelp,
  Palette,
  Code,
  Settings,
  Users,
  Heart,
  Brain,
  MapPin,
  Globe,
  PersonStandingIcon,
  Tag, // 添加Tag图标用于"其他"类别
  Home,
  Smile,
  Utensils,
  ThumbsUp,
  User,
} from "lucide-react";
import {
  FaLaptopCode,
  FaPaintBrush,
  FaBusinessTime,
  FaRegHeart,
  FaRegSmile,
  FaUserTie,
  FaMoneyBillWave,
  FaBriefcase,
  FaPlaneDeparture,
} from "react-icons/fa";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "../ui/badge";

type Category = string;

// 添加一个备用图标组件，确保即使在图标加载失败时也能显示
const FallbackIcon = () => (
  <div className="w-4 h-4 mr-2 flex items-center justify-center">
    <span className="text-xs">🏷️</span>
  </div>
);

const defaultIcon = <CircleHelp className="w-4 h-4 mr-2" />;

const iconMap: Record<string, any> = {
  // Core themes
  health: <HeartPulse className="w-4 h-4 mr-2" />,
  wellness: <Heart className="w-4 h-4 mr-2" />,
  fitness: <HeartPulse className="w-4 h-4 mr-2" />,
  education: <Book className="w-4 h-4 mr-2" />,
  learning: <Book className="w-4 h-4 mr-2" />,
  school: <Book className="w-4 h-4 mr-2" />,
  coding: <FaLaptopCode className="w-4 h-4 mr-2" />,
  programming: <Code className="w-4 h-4 mr-2" />,
  development: <Code className="w-4 h-4 mr-2" />,
  tech: <Settings className="w-4 h-4 mr-2" />,
  design: <FaPaintBrush className="w-4 h-4 mr-2" />,
  art: <Palette className="w-4 h-4 mr-2" />,
  creativity: <Palette className="w-4 h-4 mr-2" />,
  psychology: <Brain className="w-4 h-4 mr-2" />,
  mental: <Brain className="w-4 h-4 mr-2" />,
  social: <Users className="w-4 h-4 mr-2" />,
  personal: <PersonStandingIcon className="w-4 h-4 mr-2" />,
  life: <Heart className="w-4 h-4 mr-2" />,
  other: <Tag className="w-4 h-4 mr-2" />, // 为"其他"类别添加简单的Tag图标
  family: <Home className="w-4 h-4 mr-2" />,
  entertainment: <Smile className="w-4 h-4 mr-2" />,

  // Work / Career
  business: <FaBusinessTime className="w-4 h-4 mr-2" />,
  work: <FaBriefcase className="w-4 h-4 mr-2" />,
  career: <FaUserTie className="w-4 h-4 mr-2" />,
  jobs: <BriefcaseBusiness className="w-4 h-4 mr-2" />,
  finance: <FaMoneyBillWave className="w-4 h-4 mr-2" />,
  money: <FaMoneyBillWave className="w-4 h-4 mr-2" />,

  // Preferences
  preference: <FaRegHeart className="w-4 h-4 mr-2" />,
  interest: <FaRegSmile className="w-4 h-4 mr-2" />,

  // Travel & Location
  travel: <FaPlaneDeparture className="w-4 h-4 mr-2" />,
  journey: <FaPlaneDeparture className="w-4 h-4 mr-2" />,
  location: <MapPin className="w-4 h-4 mr-2" />,
  trip: <Globe className="w-4 h-4 mr-2" />,
  places: <Globe className="w-4 h-4 mr-2" />,
  
  // Chinese categories
  技术: <Code className="w-4 h-4 mr-2" />,
  学习: <Book className="w-4 h-4 mr-2" />,
  生活: <Heart className="w-4 h-4 mr-2" />,
  健康: <HeartPulse className="w-4 h-4 mr-2" />,
  工作: <FaBriefcase className="w-4 h-4 mr-2" />,
  旅行: <FaPlaneDeparture className="w-4 h-4 mr-2" />,
  艺术: <Palette className="w-4 h-4 mr-2" />,
  社交: <Users className="w-4 h-4 mr-2" />,
  个人信息: <User className="w-4 h-4 mr-2" />,
  其他: <Tag className="w-4 h-4 mr-2" />, // 为中文"其他"类别添加简单的Tag图标
  家庭: <Home className="w-4 h-4 mr-2" />,
  娱乐: <Smile className="w-4 h-4 mr-2" />,
  饮食: <Utensils className="w-4 h-4 mr-2" />,
  喜好: <ThumbsUp className="w-4 h-4 mr-2" />,
};

const getClosestIcon = (label: string): any => {
  // 先检查是否有完全匹配的图标
  if (iconMap[label]) {
    return iconMap[label];
  }
  
  const normalized = label.toLowerCase().split(/[\s\-_.,]/);

  let bestMatch: string | null = null;
  let bestScore = 0;

  Object.keys(iconMap).forEach((key) => {
    const keyTokens = key.toLowerCase().split(/[\s\-_.,]/);
    const matchScore = normalized.filter((word) =>
      keyTokens.some((token) => word.includes(token) || token.includes(word))
    ).length;

    if (matchScore > bestScore) {
      bestScore = matchScore;
      bestMatch = key;
    }
  });

  // 如果没有找到匹配的图标，使用备用图标而不是默认的问号图标
  return bestMatch ? iconMap[bestMatch] : <FallbackIcon />;
};

const getColor = (label: string): string => {
  const l = label.toLowerCase();
  
  // 特别处理"其他"类别，确保在白色主题下也能清晰显示
  if (l === "other" || label === "其他") {
    return "text-zinc-700 bg-zinc-300/80 border-zinc-400/50 dark:text-zinc-300 dark:bg-zinc-700/80 dark:border-zinc-600/50";
  }
  
  // 中文分类特殊处理 - 使用更具区分度的颜色
  if (label === "技术")
    return "text-purple-400 bg-purple-600/20 border-purple-500/30";
  if (label === "学习")
    return "text-blue-400 bg-blue-600/20 border-blue-500/30";
  if (label === "生活")
    return "text-emerald-400 bg-emerald-600/20 border-emerald-500/30";
  if (label === "健康")
    return "text-rose-400 bg-rose-600/20 border-rose-500/30";
  if (label === "工作")
    return "text-amber-400 bg-amber-600/20 border-amber-500/30";
  if (label === "旅行")
    return "text-sky-400 bg-sky-600/20 border-sky-500/30";
  if (label === "艺术")
    return "text-pink-400 bg-pink-600/20 border-pink-500/30";
  if (label === "社交")
    return "text-indigo-400 bg-indigo-600/20 border-indigo-500/30";
  if (label === "娱乐")
    return "text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-100 dark:bg-fuchsia-900/30 border-fuchsia-500/30";
  if (label === "科技")
    return "text-cyan-400 bg-cyan-600/20 border-cyan-500/30";
  if (label === "运动")
    return "text-orange-400 bg-orange-600/20 border-orange-500/30";
  if (label === "美食")
    return "text-red-400 bg-red-600/20 border-red-500/30";
  if (label === "阅读")
    return "text-violet-400 bg-violet-600/20 border-violet-500/30";
  if (label === "音乐")
    return "text-fuchsia-400 bg-fuchsia-600/20 border-fuchsia-500/30";
  if (label === "电影")
    return "text-rose-400 bg-rose-600/20 border-rose-500/30";
  if (label === "游戏")
    return "text-emerald-400 bg-emerald-600/20 border-emerald-500/30";
  if (label === "家庭")
    return "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 border-emerald-500/30";
  if (label === "朋友")
    return "text-blue-400 bg-blue-600/20 border-blue-500/30";
  if (label === "爱情")
    return "text-pink-400 bg-pink-600/20 border-pink-500/30";
  if (label === "购物")
    return "text-violet-400 bg-violet-600/20 border-violet-500/30";
  if (label === "理财")
    return "text-green-400 bg-green-600/20 border-green-500/30";
  if (label === "投资")
    return "text-teal-400 bg-teal-600/20 border-teal-500/30";
  if (label === "创业")
    return "text-orange-400 bg-orange-600/20 border-orange-500/30";
  if (label === "教育")
    return "text-indigo-400 bg-indigo-600/20 border-indigo-500/30";
  if (label === "研究")
    return "text-cyan-400 bg-cyan-600/20 border-cyan-500/30";
  if (label === "科学")
    return "text-sky-400 bg-sky-600/20 border-sky-500/30";
  if (label === "自然")
    return "text-lime-400 bg-lime-600/20 border-lime-500/30";
  if (label === "环境")
    return "text-green-400 bg-green-600/20 border-green-500/30";
  // 添加个人信息类别，使用与工作完全不同的颜色
  if (label === "个人信息")
    return "text-cyan-400 bg-cyan-600/20 border-cyan-500/30";
  // 新增分类颜色
  if (label === "饮食")
    return "text-orange-400 bg-orange-600/20 border-orange-500/30";
  if (label === "喜好")
    return "text-rose-400 bg-rose-600/20 border-rose-500/30";
  
  // 英文分类处理 - 使用更具区分度的颜色
  if (l.includes("health") || l.includes("fitness"))
    return "text-rose-400 bg-rose-600/20 border-rose-500/30";
  if (l.includes("education") || l.includes("school"))
    return "text-blue-400 bg-blue-600/20 border-blue-500/30";
  if (
    l.includes("business") ||
    l.includes("career") ||
    l.includes("work") ||
    l.includes("finance")
  )
    return "text-amber-400 bg-amber-600/20 border-amber-500/30";
  if (l.includes("design") || l.includes("art") || l.includes("creative"))
    return "text-pink-400 bg-pink-600/20 border-pink-500/30";
  if (l.includes("tech") || l.includes("code") || l.includes("programming"))
    return "text-purple-400 bg-purple-600/20 border-purple-500/30";
  if (l.includes("interest") || l.includes("preference"))
    return "text-violet-400 bg-violet-600/20 border-violet-500/30";
  if (
    l.includes("travel") ||
    l.includes("trip") ||
    l.includes("location") ||
    l.includes("place")
  )
    return "text-sky-400 bg-sky-600/20 border-sky-500/30";
  if (l.includes("personal") || l.includes("life"))
    return "text-emerald-400 bg-emerald-600/20 border-emerald-500/30";
  if (l.includes("social"))
    return "text-indigo-400 bg-indigo-600/20 border-indigo-500/30";
  if (l.includes("entertainment"))
    return "text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-100 dark:bg-fuchsia-900/30 border-fuchsia-500/30";
  if (l.includes("sports"))
    return "text-orange-400 bg-orange-600/20 border-orange-500/30";
  if (l.includes("food"))
    return "text-red-400 bg-red-600/20 border-red-500/30";
  if (l.includes("music"))
    return "text-fuchsia-400 bg-fuchsia-600/20 border-fuchsia-500/30";
  if (l.includes("movie") || l.includes("film"))
    return "text-cyan-400 bg-cyan-600/20 border-cyan-500/30";
  if (l.includes("book") || l.includes("reading"))
    return "text-violet-400 bg-violet-600/20 border-violet-500/30";
  if (l.includes("game") || l.includes("gaming"))
    return "text-emerald-400 bg-emerald-600/20 border-emerald-500/30";
  if (l.includes("family"))
    return "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 border-emerald-500/30";
  if (l.includes("friend"))
    return "text-blue-400 bg-blue-600/20 border-blue-500/30";
  if (l.includes("love"))
    return "text-pink-400 bg-pink-600/20 border-pink-500/30";
  if (l.includes("shopping"))
    return "text-purple-400 bg-purple-600/20 border-purple-500/30";
  if (l.includes("investment"))
    return "text-teal-400 bg-teal-600/20 border-teal-500/30";
  if (l.includes("science"))
    return "text-sky-400 bg-sky-600/20 border-sky-500/30";
  if (l.includes("nature"))
    return "text-lime-400 bg-lime-600/20 border-lime-500/30";
  
  // 对于未匹配的分类，基于其哈希值生成一致的颜色
  const hash = label.split('').reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);
  
  const colors = [
    "text-red-400 bg-red-600/20 border-red-500/30",
    "text-pink-400 bg-pink-600/20 border-pink-500/30",
    "text-purple-400 bg-purple-600/20 border-purple-500/30",
    "text-indigo-400 bg-indigo-600/20 border-indigo-500/30",
    "text-blue-400 bg-blue-600/20 border-blue-500/30",
    "text-cyan-400 bg-cyan-600/20 border-cyan-500/30",
    "text-teal-400 bg-teal-600/20 border-teal-500/30",
    "text-emerald-400 bg-emerald-600/20 border-emerald-500/30",
    "text-green-400 bg-green-600/20 border-green-500/30",
    "text-lime-400 bg-lime-600/20 border-lime-500/30",
    "text-yellow-400 bg-yellow-600/20 border-yellow-500/30",
    "text-amber-400 bg-amber-600/20 border-amber-500/30",
    "text-orange-400 bg-orange-600/20 border-orange-500/30",
    "text-rose-400 bg-rose-600/20 border-rose-500/30",
    "text-fuchsia-400 bg-fuchsia-600/20 border-fuchsia-500/30",
  ];
  
  return colors[hash % colors.length];
};

const Categories = ({
  categories,
  isPaused = false,
}: {
  categories: Category[];
  isPaused?: boolean;
}) => {
  if (!categories || categories.length === 0) return null;

  const baseBadgeStyle =
    "backdrop-blur-sm transition-colors hover:bg-opacity-30";
  const pausedStyle =
    "text-zinc-500 bg-zinc-800/40 border-zinc-700/40 hover:bg-zinc-800/60";

  // 直接显示所有类别
  return (
    <div className="flex flex-wrap gap-2">
      {categories?.map((cat, i) => (
        <Badge
          key={i}
          variant="outline"
          className={`${
            isPaused ? pausedStyle : `${getColor(cat)} ${baseBadgeStyle}`
          }`}
        >
          {getClosestIcon(cat)}
          {cat}
        </Badge>
      ))}
    </div>
  );
};

export default Categories;
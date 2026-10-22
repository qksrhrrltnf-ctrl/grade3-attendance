// lucide 아이콘 — 쓰는 것만 번들에 포함
import {
  createIcons,
  House, CalendarDays, ClipboardCheck, Settings, UserRound, Users, Clock, MapPin, ExternalLink,
  Bell, BellRing, BellOff, Moon, Sun, Monitor, Printer, Copy, Search, Coffee, CircleCheck, ChevronDown,
  ChevronRight, Share, SquarePlus, Download, Info, Table, LayoutGrid, TriangleAlert, Sparkles, X,
  Smartphone, ArrowRight, Check, WifiOff, RefreshCw, GraduationCap, Timer, Play, Flag, BookOpen,
  FileSpreadsheet, CalendarClock, Trash2, Star, LogOut, Shield,
} from "lucide";

const icons = {
  House, CalendarDays, ClipboardCheck, Settings, UserRound, Users, Clock, MapPin, ExternalLink,
  Bell, BellRing, BellOff, Moon, Sun, Monitor, Printer, Copy, Search, Coffee, CircleCheck, ChevronDown,
  ChevronRight, Share, SquarePlus, Download, Info, Table, LayoutGrid, TriangleAlert, Sparkles, X,
  Smartphone, ArrowRight, Check, WifiOff, RefreshCw, GraduationCap, Timer, Play, Flag, BookOpen,
  FileSpreadsheet, CalendarClock, Trash2, Star, LogOut, Shield,
};

export function refreshIcons(root = document) {
  createIcons({ icons, root });
}

/** 템플릿용: icon("bell", "w-4 h-4") */
export const icon = (name, cls = "w-4 h-4") => `<i data-lucide="${name}" class="${cls}" aria-hidden="true"></i>`;

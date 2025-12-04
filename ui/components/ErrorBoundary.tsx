"use client";

import React from "react";

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    console.error("App error boundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return <div className="fixed inset-0 w-full h-full flex items-center justify-center text-red-500">页面出现错误，请刷新或返回。</div>;
    }
    return this.props.children as any;
  }
}
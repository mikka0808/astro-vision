import { useEffect } from "react";

function updateViewportVariable() {
  const viewport = window.visualViewport;
  const height = viewport ? viewport.height : window.innerHeight;
  document.documentElement.style.setProperty("--vh", `${height / 100}px`);
  document.documentElement.style.setProperty("--dvh", `${height}px`);
}

export function useViewportHeight() {
  useEffect(() => {
    updateViewportVariable();

    const handleResize = () => updateViewportVariable();
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
      }
    };
  }, []);
}

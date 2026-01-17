const plugin = require("tailwindcss/plugin");

/**
 * Lightweight scrollbar plugin mirroring `tailwind-scrollbar` defaults.
 * Supports `.scrollbar`, `.scrollbar-thin`, and `.scrollbar-none` utilities.
 */
module.exports = function tailwindScrollbar(options = {}) {
  const className = options.name || "scrollbar";
  const nocompatible = options.nocompatible ?? false;

  return plugin(function ({ addUtilities }) {
    const utilities = {
      [`.${className}`]: {
        "scrollbar-width": "auto"
      },
      [`.${className}-thin`]: {
        "scrollbar-width": "thin"
      },
      [`.${className}-none`]: {
        "scrollbar-width": "none"
      },
      [`.${className}::-webkit-scrollbar`]: {
        width: "12px",
        height: "12px"
      },
      [`.${className}-thin::-webkit-scrollbar`]: {
        width: "8px",
        height: "8px"
      },
      [`.${className}-none::-webkit-scrollbar`]: {
        width: "0px",
        height: "0px"
      },
      [`.${className}::-webkit-scrollbar-track`]: {
        background: "transparent"
      },
      [`.${className}::-webkit-scrollbar-thumb`]: {
        background: "rgba(100, 116, 139, 0.5)",
        "border-radius": "9999px",
        border: "2px solid transparent",
        "background-clip": "padding-box"
      },
      [`.${className}::-webkit-scrollbar-thumb:hover`]: {
        background: "rgba(100, 116, 139, 0.7)"
      }
    };

    addUtilities(utilities, ["responsive"]);

    if (!nocompatible) {
      addUtilities(
        {
          [`.${className}`]: {
            "-ms-overflow-style": "auto"
          }
        },
        ["responsive"]
      );
    }
  });
};

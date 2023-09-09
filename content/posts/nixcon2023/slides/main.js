import Reveal from "reveal.js";
import RevealMarkdown from "reveal.js/plugin/markdown";
import RevealHighlight from "reveal.js/plugin/highlight";
import RevealNotes from "reveal.js/plugin/notes";

Reveal.initialize({
    hash: true,

    // Learn about plugins: https://revealjs.com/plugins/
    plugins: [RevealMarkdown, RevealHighlight, RevealNotes],
    transitionSpeed: "fast",
    transition: "none",
    slideNumber: true,

    margin: 0.04,
    disableLayout: true,
});

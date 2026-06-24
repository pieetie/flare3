(function () {
  const LINKS = [
    { label: "Primer3", url: "https://primer3.ut.ee/" },
    { label: "Beacon Designer", url: "http://www.premierbiosoft.com/qOligo/Oligo.jsp?PID=1" },
    { label: "Nucleotide BLAST", url: "https://blast.ncbi.nlm.nih.gov/Blast.cgi?PAGE=Nucleotides&PROGRAM=blastn&PAGE_TYPE=BlastSearch&BLAST_SPEC=" },
    { label: "ThermoFisher", url: "https://www.thermofisher.com/fr/fr/home/brands/thermo-scientific/molecular-biology/molecular-biology-learning-center/molecular-biology-resource-library/thermo-scientific-web-tools/multiple-primer-analyzer.html" },
  ];

  const TOOLS_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><path d="m10,17c-1.3807,0-2.5-3.134-2.5-7s1.1193-7,2.5-7c1.1019,0,2.0373,1.9961,2.3701,4.7674" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path><path d="m10,17c-3.866,0-7-3.134-7-7s3.134-7,7-7c3.6244,0,6.6054,2.7545,6.9639,6.2843" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path><line x1="3" y1="10" x2="8.5" y2="10" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></line><polygon points="11.5 11 17.5 13 14.5 14 13.5 17 11.5 11" fill="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></polygon></svg>';

  const LINK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><polyline points="12 12 12 8 8 8" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></polyline><line x1="3" y1="17" x2="12" y2="8" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></line><path d="m7.95,17h5.05c1.657,0,3-1.343,3-3V6c0-1.657-1.343-3-3-3h-6c-1.657,0-3,1.343-3,3v5.05" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>';

  function build() {
    const rail = document.createElement("aside");
    rail.className = "rail";
    let html = '<div class="rail-title">' + TOOLS_ICON + "<span>Tools</span></div>";
    for (const l of LINKS) {
      html +=
        '<a class="rail-link" href="' + l.url + '" target="_blank" rel="noopener">' +
        "<span>" + l.label + "</span>" + LINK_ICON +
        "</a>";
    }
    rail.innerHTML = html;
    (document.querySelector(".layout") || document.body).appendChild(rail);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();

import React from "react";

const update = __SITE_UPDATE__;
const date = new Date(update.updatedAt);
const formatted = new Intl.DateTimeFormat("es-HN", {
  timeZone: "America/Tegucigalpa", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: false
}).format(date);

export default function SiteFooter() {
  return <footer className="site-footer">
    <small>Actualización {update.number} · <time dateTime={update.updatedAt}>{formatted}</time> (Honduras)</small>
  </footer>;
}

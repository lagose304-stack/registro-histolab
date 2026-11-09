import React from "react";
import "./MakeupAttendanceBadge.css";
export default function MakeupAttendanceBadge({ value }) {
  if (!["Repuso","No repuso"].includes(value)) return null;
  return <span className="makeup-attendance-badge" data-result={value}>{value}</span>;
}

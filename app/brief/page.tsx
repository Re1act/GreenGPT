import type { Metadata } from "next";
import LocalBrief from "@/components/brief/LocalBrief";
export const metadata: Metadata = { title: "Local brief" };
export default function BriefPage() { return <LocalBrief />; }

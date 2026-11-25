import { Tracker } from "@/components/Tracker";
import { Topbar } from "@/components/Topbar";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Mapa por defecto (configurable con DEFAULT_LAT / DEFAULT_LNG / DEFAULT_ZOOM). */
const CFG = {
  lat: Number(process.env.DEFAULT_LAT ?? -34.6037),
  lng: Number(process.env.DEFAULT_LNG ?? -58.3816),
  zoom: Number(process.env.DEFAULT_ZOOM ?? 13),
};

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <>
      <Topbar user={user} />
      <Tracker user={user} cfg={CFG} />
    </>
  );
}

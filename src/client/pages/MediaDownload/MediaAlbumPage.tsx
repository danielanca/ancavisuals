// pages/media/[slug].tsx
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import BunnyPhotoGallery from "./../Portfolio/BunnyPhotoGallery";

export default function MediaPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [album, setAlbum] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    async function load() {
      const res = await fetch(`/api/album/${slug}`);
      const data = await res.json();
      setAlbum(data);
      setLoading(false);
    }

    load();
  }, [slug]);

  if (loading) return <p>Loading...</p>;
  if (!album) return <p>Album not found.</p>;

  return (
    <div style={{ padding: "40px 20px" }}>
      <h1 style={{ fontSize: "2.2rem" }}>{album.title}</h1>

      {/* Featured */}
      {album.featured?.length > 0 && (
        <>
          <h2>Featured</h2>
          <BunnyPhotoGallery photos={album.featured} />
        </>
      )}

      {/* Photos */}
      {album.photos?.length > 0 && (
        <>
          <h2 style={{ marginTop: 40 }}>Photos</h2>
          <BunnyPhotoGallery photos={album.photos} />
        </>
      )}

      {/* Short video */}
      {album.shortvideo && (
        <>
          <h2 style={{ marginTop: 40 }}>Short Video</h2>
          <video
            controls
            src={album.shortvideo}
            style={{ width: "100%", maxWidth: 900, borderRadius: 12 }}
          />
        </>
      )}

      {/* Long video */}
      {album.longvideo && (
        <>
          <h2 style={{ marginTop: 40 }}>Full Wedding Film</h2>
          <a
            href={album.longvideo}
            download
            style={{
              padding: "12px 20px",
              background: "#2c8377",
              color: "white",
              borderRadius: 6,
              display: "inline-block",
              marginTop: 10,
            }}
          >
            Download Video
          </a>
        </>
      )}
    </div>
  );
}

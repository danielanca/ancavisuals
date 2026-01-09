"use client";

import { useForm } from "react-hook-form";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db, auth } from "../../../firebase";
import { Navigate, useNavigate } from "react-router-dom";
import { useState } from "react";
import styles from "./CreateEvent.module.scss";

interface EventFormData {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
}

const CreateEventDashboard = () => {
  const { register, handleSubmit, watch } = useForm<EventFormData>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const watchAll = watch();
  const onSubmit = async (data: EventFormData) => {
    const user = auth.currentUser;
    if (!user) return alert("You must be logged in");
  
    try {
      setLoading(true);
  
      const res = await fetch("/api/create-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,// pass host ID
          receivers: [
            {
              name: "Test",
              email: "test@example.com",
              phone: "08000000000",
            },
          ],
        }),
      });
  
      if (!res.ok) {
        throw new Error("Request failed");
      }
  
      const json = await res.json();
      console.log("Event created:", json);
    } catch (error) {
      console.error(error);
      alert("Failed to create event"+error);
    } finally {
      setLoading(false);
    }
  };
  

  return (
    <div className={styles.wrapper}>
      <div className={styles.container}>
        <h1 className={styles.title}>Create New Event</h1>

        <div className={styles.card}>
          <div className={styles.grid}>
            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
              <div className={styles.group}>
                <label>Event Title</label>
                <input {...register("title", { required: true })} placeholder="e.g. John & Mary Wedding" />
              </div>

              <div className={styles.group}>
                <label>Description</label>
                <textarea {...register("description")} placeholder="Event description" />
              </div>

              <div className={styles.row}>
                <div className={styles.group}>
                  <label>Date</label>
                  <input type="date" {...register("date", { required: true })} />
                </div>
                <div className={styles.group}>
                  <label>Time</label>
                  <input type="time" {...register("time", { required: true })} />
                </div>
              </div>

              <div className={styles.group}>
                <label>Location</label>
                <input {...register("location", { required: true })} placeholder="Event location or link" />
              </div>

              <button type="submit" className={styles.button} disabled={loading}>
                {loading ? "Creating..." : "Create Event"}
              </button>
            </form>

            {/* Preview */}
            <div className={styles.preview}>
              <p className={styles.previewLabel}>Live Preview</p>
              <h2>{watchAll.title || "Event Title"}</h2>
              <p className={styles.previewDescription}>
                {watchAll.description || "Event description will appear here."}
              </p>
              <div className={styles.previewMeta}>
                <p>📅 {watchAll.date || "Date"} {watchAll.time && `at ${watchAll.time}`}</p>
                <p>📍 {watchAll.location || "Location"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export default CreateEventDashboard;
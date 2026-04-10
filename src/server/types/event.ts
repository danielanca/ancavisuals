export interface eventModel {
        title: string
        description: string
        date: string
        time: string
        location: string
        hostId: string
        createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | null
    
}

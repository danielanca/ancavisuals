
import { db } from '../../firestoreInit';
import { Firestore, CollectionReference, DocumentReference } from 'firebase-admin/firestore';
// Assuming Firebase Admin has been initialized elsewhere in your application

interface discussionInterface{
    accountID: string;
    departmentId:string;
    discussionState:string;
}


async function getDynamicDocumentOrCollection(pathArray:string[]): Promise<any> {
    let currentRef : Firestore | DocumentReference | CollectionReference = db;

    for (let i = 0; i < pathArray.length; i++) {
        if (i % 2 === 0) {
            if (currentRef instanceof Firestore || currentRef instanceof DocumentReference) {
                currentRef = currentRef.collection(pathArray[i]);
            }else{ throw new Error('Attemp to access a collection on a reference')}
        } else {
            if(currentRef instanceof CollectionReference){
                currentRef = currentRef.doc(pathArray[i]);
            }else{
                throw new Error('Attempted to access a document on a reference');
            }
        }
    }

    try {
        if (currentRef instanceof CollectionReference) {
            const snapshot = await currentRef.get();
            if (snapshot.empty) {
                console.log("No matching documents.");
                return [];
            }
            return snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
        } else if (currentRef instanceof DocumentReference) {
            const docSnap = await currentRef.get();
            if (!docSnap.exists) {
                console.log("No such document!");
                return null;
            }
            return docSnap.data();
        } else {
            throw new Error('currentRef is not pointing to a DocumentReference or CollectionReference');
        }
    } catch (error) {
        console.error("Error accessing Firestore:", error);
        return null;
    }
}



async function saveDiscussionStateToDB(data:discussionInterface) : Promise<any>{
    const docRef = db.collection('accounts').doc(data.accountID);
    console.log('We trying to acces for saving ', docRef);

    try {
        // Update the discussionState within the forensic department using dot notation
        await docRef.update({
            // Dot notation to specify the path to the nested field
            'uic.departments.forensic.discussionState': data.discussionState
        });

        console.log(`Discussion state updated successfully for account ID: ${data.accountID}`);
    } catch (error) {
        console.error('Error updating discussion state: ', error);
    }
}


async function testDirectAccess() {
    const docRef = db.collection('accounts').doc('daniel.anca');
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      console.log("Direct access document data:", docSnap.data());
    } else {
      console.log("Direct access: No such document!");
    }
  }
  
  testDirectAccess();
  

export { getDynamicDocumentOrCollection, saveDiscussionStateToDB, db };

import React from "react";
import { useParams } from "react-router-dom";
import { UserProfilesData } from "../../data/UserProfilesData";
import styles from "./SingleUser.module.scss";
import TopBar from "./TopBar";
import { Footer } from "./common/Footer";
import Header from "./common/Header";
import { useNavigate } from "react-router-dom";

const SingleUser = () => {
  const navigate = useNavigate();
  const { userID } = useParams();
  const user = UserProfilesData.find(user => user.id.toString() === userID);

  if (!user) {
    return <div>User not found</div>;
  }

  return (
    <>
      <TopBar />
      <Header />
      <div className={styles.headerUser}>
        <div className="my-5 w-[85%] mx-auto">
          <div>
            <div className="flex flex-col font-normal">
              <span className="text-base text-[#000000]">Welcome back,</span>
              <span className="text-base text-[#A3A3A3]">{"detectiv Daniel Anca"}</span>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.backBtn}>
        <div
          className="mt-4 h-9 w-24 font-normal text-base text-[#FFFFFF] bg-[#202A56] flex items-center justify-center cursor-pointer"
          onClick={() => navigate("/game/most-wanted")}
        >
          INAPOI
        </div>
      </div>
      <div className={styles.userContainer}>
        {user && (
          <div className={styles.singleUserPage}>
            <div className={styles.userPhoto}>
              <img src={user.Img} alt="img" />
              <div className={styles.userName}>{user.name}</div>
            </div>

            <div className={styles.userDetails}>
              <div className={styles.userDOB}>Date of Birth : {user.dob}</div>
              <div>Cetatenie: {user.cetatenie}</div>
              <div>
                Resedinta: {user.oras}, jud. {user.judet}
              </div>
              <div className={styles.userCrime}> Acuzatie : {user.crime}</div>
            </div>

            <div className={styles.grayLine}></div>
            <div className={styles.descTitle}>Detalii</div>
            <div className={styles.userDescription}>
              <div>{user.description}</div>
            </div>
            <div className={styles.fpTitle}>Amprentă inregistrată</div>
            <div className={styles.fingerPrint}>
              <img src={user.fingerPrint} alt="img" />
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};

export default SingleUser;

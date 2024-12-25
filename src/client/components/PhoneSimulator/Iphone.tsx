import React from 'react'
// import './Iphone.scss'
import './Iphone.css'

const Iphone: React.FC = () => {
    const iconStyle1 = {
        backgroundImage: "url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Fllamadas.png?alt=media&token=24b6d8a0-d111-4e85-bf53-39f23de9145a)"
    };


    const iconStyle2 = {
        backgroundImage: "url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Fsafari.png?alt=media&token=aec77205-ccfe-4b77-ae66-272843db2abe)"
    };

    const iconStyle3 = {
        backgroundImage: "url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Fwhatsapp.png?alt=media&token=b3416a44-56fc-4991-a10b-e4a34944bf3c)"
    };

    const iconStyle4 = {
        backgroundImage: "url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Ffacebook.png?alt=media&token=f383d17e-32a7-49ef-8ebb-c723d556baa2)"
    };

    const iconStyle5 = {
        backgroundImage: "url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Ffacetime.png?alt=media&token=4c66d073-d44e-4671-878e-6a8dd1dc7956)"
    };

    const iconStyle6 = {
        backgroundImage: "url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Fllamadas.png?alt=media&token=24b6d8a0-d111-4e85-bf53-39f23de9145a)"
    };

    const iconStyle7 = {
        backgroundImage: "url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Fwhatsapp.png?alt=media&token=b3416a44-56fc-4991-a10b-e4a34944bf3c)"
    };

    const iconStyle8 = {
        backgroundImage: "url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Ffacebook.png?alt=media&token=f383d17e-32a7-49ef-8ebb-c723d556baa2)"
    };

    const iconStyle9 = {
        backgroundImage: "url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Fsafari.png?alt=media&token=aec77205-ccfe-4b77-ae66-272843db2abe)"
    };

    const iconStyle10 = {
        backgroundImage: "url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Ftwitter.png?alt=media&token=4360a8ea-afce-4f20-9057-bb2d4d5a9e41)"
    };

     const iconStyle11 = {
        backgroundImage: "url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Ffotos.png?alt=media&token=86d712fd-aab1-48a3-a6d0-f2b5b7f9a2ab)"
     };
    
    const svgStyle1 = {
        transform: "rotate(90deg)"
    };

    const svgStyle2 = {
        transform: "rotate(180deg)"
    };

    const svgStyle3 = {
        transform: "rotate(90deg)"  // Apply a 90-degree rotation
    };




    return (
        <>
            <section className="iphoneMock">
                <div className="container">
                    <div className="iphone initAnimation">
                        <div className="bordeColor">
                            <div className="botones">
                                <div className="switch"></div>
                                <div className="vol up"></div>
                                <div className="vol down"></div>
                                <div className="touchID"></div>
                            </div>
                            <div className="backSide">
                                <div className="camaras">
                                    <div className="cam">
                                        <div className="lente"></div>
                                    </div>
                                    <div className="cam">
                                        <div className="lente"></div>
                                    </div>
                                    <div className="cam">
                                        <div className="lente"></div>
                                    </div>
                                    <div className="flash"></div>
                                    <div className="sensor"></div>
                                </div>
                                <div className="logo">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
                                        <path d="M48.334 33.875c-.093-7.593 6.169-11.249 6.45-11.436a13.669 13.669 0 0 0-10.936-5.906c-4.674-.469-9.067 2.718-11.5 2.718-2.337 0-5.982-2.718-9.908-2.625a14.765 14.765 0 0 0-12.339 7.5C4.868 33.313 8.794 47 13.935 54.4c2.524 3.656 5.515 7.78 9.441 7.593 3.832-.187 5.235-2.437 9.815-2.437S39.08 62 43.1 61.9c4.113-.094 6.637-3.75 9.16-7.405a29.782 29.782 0 0 0 4.113-8.53 13.082 13.082 0 0 1-8.039-12.09z"></path>
                                        <path d="M40.762 11.565A13.423 13.423 0 0 0 43.847 2a13.194 13.194 0 0 0-8.787 4.5c-1.963 2.25-3.645 5.812-3.178 9.28 3.365.284 6.824-1.68 8.88-4.215z"></path>
                                    </svg>
                                </div>
                            </div>
                            <div className="bordeNegro">
                                <div className="notch">
                                    <div className="bocina"></div>
                                    <div className="camara"></div>
                                </div>
                                <div className="logo">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
                                        <path d="M48.334 33.875c-.093-7.593 6.169-11.249 6.45-11.436a13.669 13.669 0 0 0-10.936-5.906c-4.674-.469-9.067 2.718-11.5 2.718-2.337 0-5.982-2.718-9.908-2.625a14.765 14.765 0 0 0-12.339 7.5C4.868 33.313 8.794 47 13.935 54.4c2.524 3.656 5.515 7.78 9.441 7.593 3.832-.187 5.235-2.437 9.815-2.437S39.08 62 43.1 61.9c4.113-.094 6.637-3.75 9.16-7.405a29.782 29.782 0 0 0 4.113-8.53 13.082 13.082 0 0 1-8.039-12.09z"></path>
                                        <path d="M40.762 11.565A13.423 13.423 0 0 0 43.847 2a13.194 13.194 0 0 0-8.787 4.5c-1.963 2.25-3.645 5.812-3.178 9.28 3.365.284 6.824-1.68 8.88-4.215z"></path>
                                    </svg>
                                </div>
                                <div className="mainScreen bloqueado">
                                    <div className="statusBar">
                                        <div className="leftSide">
                                            <div className="operador">Telcel</div>
                                            <div className="hora hidden"></div>
                                            <div className="widgetPlus"></div>
                                        </div>
                                        <div className="rightSide">
                                            <div className="signal mid"><i className="bar"></i></div>
                                            <div className="datos">5G</div>
                                            <div className="bateria mid"></div>
                                            <div className="exitShake">Listo</div>
                                        </div>
                                    </div>
                                    <div className="lockScreen">
                                        <div className="up">
                                            <div className="lockIcon"></div>
                                            <div className="hora"></div>
                                            <div className="fecha">Miércoles, 16 de Septiembre</div>
                                        </div>
                                        <div className="down">
                                            <div className="sysIcon flash">
                                                <svg xmlns="http://www.w3.org/2000/svg" x="0" y="0" viewBox="0 0 400 400">
                                                    <path d="M117,62.85v13.72c0,32.45,10.64,61.49,27.43,81.57v206.43h109.71V158.14c16.79-20.08,27.43-49.12,27.43-81.57 V62.85H117z M203.37,246.86c0,6.45-10,6.43-10,0v-41.88c0-6.45,10-6.43,10,0V246.86z M259.35,73.33H136.65c-6.45,0-6.43-10,0-10 h122.69C265.79,63.33,265.78,73.33,259.35,73.33z" />
                                                    <path d="M144.43,364.57v13.71c0,7.57,6.14,13.72,13.71,13.72h82.29c7.57,0,13.71-6.15,13.71-13.72v-13.71H144.43z M144.43,364.57" />
                                                    <path d="M267.86,8H130.71C123.14,8,117,14.14,117,21.71v41.14h164.57V21.71C281.57,14.14,275.43,8,267.86,8L267.86,8z M267.86,8" />
                                                    <path d="M267.86,8h-68.57v54.85h-82.07v13.72h164.35V21.71C281.57,14.14,275.43,8,267.86,8z M259.35,73.33H136.65 c-6.45,0-6.43-10,0-10h122.69C265.79,63.33,265.78,73.33,259.35,73.33z" />
                                                    <path d="M199.29,364.57v13.71h-54.86c0,7.57,6.14,13.72,13.71,13.72h82.29c7.57,0,13.71-6.15,13.71-13.72v-13.71 H199.29z M199.29,364.57" />
                                                    <path d="M257.68,153.45c5.97-8.05,11-17.29,14.9-27.46C268.35,136.16,263.34,145.37,257.68,153.45L257.68,153.45z M257.68,153.45" />
                                                    <path d="M199.29,158.85c-15.13,0-27.43,12.29-27.43,27.43c0,13.11,9.22,24.07,21.51,26.78v-8.09c0-6.45,10-6.43,10,0 v8.43c13.2-1.98,23.35-13.37,23.35-27.13C226.72,171.15,214.41,158.85,199.29,158.85z" />
                                                    <path d="M218.68,166.9l-9.7,9.69c-2.48-2.48-5.91-4.02-9.7-4.02c-7.55,0-13.72,6.14-13.72,13.71 c0,3.79,1.54,7.22,4.02,9.7l-9.7,9.7c3.84,3.84,8.53,6.29,13.47,7.37v-8.07c0-6.45,10-6.43,10,0v8.41 c5.61-0.84,11-3.41,15.31-7.72C229.39,194.98,229.38,177.58,218.68,166.9z" />
                                                </svg>
                                            </div>
                                            <div className="sysIcon camara">
                                                <svg xmlns="http://www.w3.org/2000/svg" x="0" y="0" viewBox="0 0 512 512">
                                                    <circle cx="256" cy="296" r="81" />
                                                    <path d="m374.297 91-5.177-25.883c-2.794-13.974-15.166-24.117-29.417-24.117h-167.406c-14.25 0-26.623 10.143-29.417 24.117l-5.177 25.883z" />
                                                    <path d="m467 121c-35.223 0-405.516 0-422 0-24.813 0-45 20.187-45 45v260c0 24.813 20.187 45 45 45h422c24.813 0 45-20.187 45-45v-260c0-24.813-20.187-45-45-45zm-339 94h-48c-8.284 0-15-6.716-15-15s6.716-15 15-15h48c8.284 0 15 6.716 15 15s-6.716 15-15 15zm128 192c-61.206 0-111-49.794-111-111s49.794-111 111-111 111 49.794 111 111-49.794 111-111 111z" />
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="unlockBar" data-msj="Desliza hacia arriba para desbloquear"></div>
                                    </div>
                                    <div className="appScreen hidden">
                                        <div className="mainApps">
                                            <div className="wrapperApps"></div>
                                        </div>
                                        <div className="wrapperDots"></div>
                                        <div className="deckApps">
                                            <div className="app" data-indeck="1">
                                                {/* <div className="icono" style="background-image: url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Fllamadas.png?alt=media&token=24b6d8a0-d111-4e85-bf53-39f23de9145a);"></div> */}
                                                <div className="icono" style={iconStyle1}></div>

                                            </div>
                                            <div className="app" data-indeck="2">
                                                {/* <div className="icono" style="background-image: url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Fsafari.png?alt=media&token=aec77205-ccfe-4b77-ae66-272843db2abe);"></div> */}
                                                    <div className="icono" style={iconStyle2}></div>

                                            </div>
                                            <div className="app" data-indeck="3">
                                                {/* <div className="icono" style="background-image: url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Fwhatsapp.png?alt=media&token=b3416a44-56fc-4991-a10b-e4a34944bf3c);"></div> */}
                                                <div className="icono" style={iconStyle3}></div>

                                            </div>
                                            <div className="app" data-indeck="4">
                                                {/* <div className="icono" style="background-image: url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Ffacebook.png?alt=media&token=f383d17e-32a7-49ef-8ebb-c723d556baa2);"></div> */}
                                                <div className="icono" style={iconStyle4}></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="widgetCenter hidden">
                                        <div className="buscador"><div className="icono"></div>Buscar</div>
                                        <div className="contenido">
                                            <div className="block actions">
                                                <div className="action">
                                                    {/* <div className="icono" style="background-image: url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Ffacetime.png?alt=media&token=4c66d073-d44e-4671-878e-6a8dd1dc7956);"></div> */}
                                                    <div className="icono" style={iconStyle5}></div>
                                                    <div className="textos">
                                                        <p className="actionName">Iniciar FaceTime con Jorge Aguilar</p>
                                                        <p className="actionApp">FaceTime</p>
                                                    </div>
                                                </div>
                                                <div className="action">
                                                    {/* <div className="icono" style="background-image: url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Fllamadas.png?alt=media&token=24b6d8a0-d111-4e85-bf53-39f23de9145a);"></div> */}
                                                    <div className="icono" style={iconStyle6}></div>
                                                    <div className="textos">
                                                        <p className="actionName">Llamar a Jorge Aguilar</p>
                                                        <p className="actionApp">Teléfono</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="block midd eventos">
                                                <p className="txt">Sin más eventos para hoy</p>
                                            </div>
                                            <div className="block midd bateriaInfo" data-carga="59">
                                                <div className="iconoWrapper">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
                                                        <path d="M14 59a3 3 0 0 0 3 3h30a3 3 0 0 0 3-3v-9H14zM50 5a3 3 0 0 0-3-3H17a3 3 0 0 0-3 3v5h36zm0 45V10m-36 0v40"></path>
                                                        <circle cx="32" cy="56" r="2"></circle>
                                                    </svg>
                                                </div>
                                            </div>
                                            <div className="block tiempoPantalla">
                                                <p className="timepo">3h 27min</p>
                                                <div className="app">
                                                    {/* <div className="icono"
                                                        style="background-image: url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Fwhatsapp.png?alt=media&token=b3416a44-56fc-4991-a10b-e4a34944bf3c);">
                                                    </div> */}
                                                    <div className="icono" style={iconStyle7}></div>
                                                    <div className="textos">
                                                        <p className="actionName">WhatsApp</p>
                                                        <p className="actionApp">38min</p>
                                                    </div>
                                                </div>
                                                <div className="app">
                                                    {/* <div className="icono"
                                                        style="background-image: url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Ffacebook.png?alt=media&token=f383d17e-32a7-49ef-8ebb-c723d556baa2);">
                                                    </div> */}
                                                    <div className="icono" style={iconStyle8}></div>
                                                    <div className="textos">
                                                        <p className="actionName">Facebook</p>
                                                        <p className="actionApp">1h 49min</p>
                                                    </div>
                                                </div>
                                                <div className="app">
                                                    {/* <div className="icono"
                                                        style="background-image: url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Fsafari.png?alt=media&token=aec77205-ccfe-4b77-ae66-272843db2abe);">
                                                    </div> */}
                                                    <div className="icono" style={iconStyle9}></div>
                                                    <div className="textos">
                                                        <p className="actionName">Safari</p>
                                                        <p className="actionApp">22min</p>
                                                    </div>
                                                </div>
                                                <div className="app">
                                                    {/* <div className="icono"
                                                        style="background-image: url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Ftwitter.png?alt=media&token=4360a8ea-afce-4f20-9057-bb2d4d5a9e41);">
                                                    </div> */}
                                                    <div className="icono" style={iconStyle10}></div>
                                                    <div className="textos">
                                                        <p className="actionName">Twitter</p>
                                                        <p className="actionApp">59min</p>
                                                    </div>
                                                </div>
                                                <div className="app">
                                                    {/* <div className="icono"
                                                        style="background-image: url(https://firebasestorage.googleapis.com/v0/b/fotos-3cba1.appspot.com/o/ios14%2Ffotos.png?alt=media&token=86d712fd-aab1-48a3-a6d0-f2b5b7f9a2ab);">
                                                    </div> */}
                                                    <div className="icono" style={iconStyle11}></div>
                                                    <div className="textos">
                                                        <p className="actionName">Fotos</p>
                                                        <p className="actionApp">3min</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="editButton">Editar</div>
                                        </div>
                                    </div>
                                    <div className="widgetScreen hidden">
                                        <div className="wrapper">
                                            <div className="buscador"><div className="icono"></div>Buscar widgets</div>
                                            <div className="widgetWrapper">
                                                <div className="widget full">
                                                    <div className="preview"></div>
                                                    <p className="nombre">Pila inteligente</p>
                                                </div>
                                                <div className="widget">
                                                    <div className="preview"></div>
                                                    <p className="nombre">Notas</p>
                                                </div>
                                                <div className="widget">
                                                    <div className="preview"></div>
                                                    <p className="nombre">Mapas</p>
                                                </div>
                                                <div className="widget">
                                                    <div className="preview"></div>
                                                    <p className="nombre">Música</p>
                                                </div>
                                                <div className="widget">
                                                    <div className="preview"></div>
                                                    <p className="nombre">Podcast</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="controlCenter hidden">
                                        <div className="content">
                                            <div className="iconsGroup iconWrapper-wX2 padding">
                                                <div className="actionIcon icon modoVuelo">
                                                    <div className="ico">
                                                        {/* <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 510 510" style="transform: rotate(90deg);">
                                                            <path d="M497.25,357v-51l-204-127.5V38.25C293.25,17.85,275.4,0,255,0c-20.4,0-38.25,17.85-38.25,38.25V178.5L12.75,306v51 l204-63.75V433.5l-51,38.25V510L255,484.5l89.25,25.5v-38.25l-51-38.25V293.25L497.25,357z"></path>
                                                        </svg> */}
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 510 510" style={svgStyle1}>
            <path d="M497.25,357v-51l-204-127.5V38.25C293.25,17.85,275.4,0,255,0c-20.4,0-38.25,17.85-38.25,38.25V178.5L12.75,306v51 l204-63.75V433.5l-51,38.25V510L255,484.5l89.25,25.5v-38.25l-51-38.25V293.25L497.25,357z"></path>
        </svg>
                                                    </div>
                                                    <div className="txt">
                                                        <p className="name">Modo de vuelo</p>
                                                        <p className="val">No</p>
                                                    </div>
                                                </div>
                                                <div className="actionIcon icon datosCelulares activo">
                                                    <div className="ico">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 510 510">
                                                            <path d="m255.991 169.039c-30.327 0-55 24.673-55 55 0 25.127 16.943 46.356 40 52.904v171.096c0 8.284 6.716 15 15 15s15-6.716 15-15v-171.096c23.057-6.547 40-27.777 40-52.904 0-30.327-24.673-55-55-55z"></path>
                                                            <path d="m186.597 143.845c-5.857-5.858-15.354-5.858-21.213 0-46.505 46.503-46.512 121.781 0 168.291 5.859 5.858 15.355 5.858 21.213 0 5.858-5.857 5.858-15.355 0-21.213-34.78-34.779-34.786-91.08 0-125.865 5.858-5.858 5.858-15.356 0-21.213z"></path>
                                                            <path d="m346.597 143.845c-5.857-5.857-15.355-5.857-21.213 0s-5.858 15.355 0 21.213c34.701 34.701 34.701 91.164 0 125.865-5.858 5.857-5.858 15.355 0 21.213 5.859 5.858 15.355 5.858 21.213 0 46.399-46.397 46.399-121.894 0-168.291z"></path>
                                                            <path d="m141.342 119.803c5.858-5.857 5.858-15.355 0-21.213-5.857-5.857-15.355-5.857-21.213 0-71.352 71.352-71.352 187.449 0 258.801 5.856 5.857 15.354 5.86 21.213 0 5.858-5.857 5.858-15.355 0-21.213-59.654-59.655-59.654-156.72 0-216.375z"></path>
                                                            <path d="m391.852 98.59c-5.857-5.857-15.355-5.857-21.213 0s-5.858 15.355 0 21.213c59.654 59.655 59.654 156.72 0 216.375-5.858 5.857-5.858 15.355 0 21.213 5.859 5.858 15.355 5.858 21.213 0 71.352-71.352 71.352-187.449 0-258.801z"></path>
                                                            <path d="m96.087 74.548c5.858-5.857 5.858-15.355 0-21.213-5.857-5.857-15.355-5.857-21.213 0-99.941 99.94-99.724 249.587 0 349.311 5.856 5.857 15.354 5.86 21.213 0 5.858-5.857 5.858-15.355 0-21.213-87.475-87.477-87.475-219.408 0-306.885z"></path>
                                                            <path d="m437.107 53.335c-5.857-5.857-15.355-5.857-21.213 0s-5.858 15.355 0 21.213c87.477 87.477 87.477 219.408 0 306.885-5.858 5.857-5.858 15.355 0 21.213 5.859 5.858 15.355 5.858 21.213 0 99.94-99.939 99.725-249.587 0-349.311z"></path>
                                                        </svg>
                                                    </div>
                                                    <div className="txt">
                                                        <p className="name">Datos celulares</p>
                                                        <p className="val">No</p>
                                                    </div>
                                                </div>
                                                <div className="actionIcon icon wifi">
                                                    <div className="ico">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 470 470">
                                                            <path d="M170.667,336.6l64,64l64-64C263.36,301.293,205.973,301.293,170.667,336.6z"></path>
                                                            <path d="M85.333,251.267L128,293.933c58.88-58.88,154.453-58.88,213.333,0L384,251.267 C301.547,168.813,167.787,168.813,85.333,251.267z"></path>
                                                            <path d="M0,165.933L42.667,208.6c106.027-106.027,277.973-106.027,384,0l42.667-42.667C339.733,36.333,129.6,36.333,0,165.933z"></path>
                                                        </svg>
                                                    </div>
                                                    <div className="txt">
                                                        <p className="name">Wi-Fi</p>
                                                        <p className="val">CODEPEN-1234</p>
                                                    </div>
                                                </div>
                                                <div className="actionIcon icon bluetooth">
                                                    <div className="ico">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                                                            <path d="M413.913,148.622L234.447,0v211.397L123.846,118.51l-25.759,30.672l126.44,106.189L98.087,361.56l25.759,30.672    l110.601-92.887V512l179.381-149.95L286.806,255.371L413.913,148.622z M274.501,85.175l76.876,63.663l-76.876,64.563V85.175z M351.463,361.978l-76.962,64.336V297.342L351.463,361.978z"></path>
                                                        </svg>
                                                    </div>
                                                    <div className="txt">
                                                        <p className="name">Bluetooth</p>
                                                        <p className="val">No</p>
                                                    </div>
                                                </div>
                                                <div className="actionIcon icon airDrop" style={{ display: 'none'}}>
                                                    <div className="ico"></div>
                                                    <div className="txt">
                                                        <p className="name">AirDrop</p>
                                                        <p className="val">No recibir</p>
                                                    </div>
                                                </div>
                                                <div className="actionIcon icon compartirInternet" style={{ display: 'none'}}>
                                                    <div className="ico"></div>
                                                    <div className="txt">
                                                        <p className="name">Compartir internet</p>
                                                        <p className="val">No</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="musicWdg iconWrapper-wX2 padding">
                                                <p className="songName">Summertime</p>
                                                <p className="artistName">Orville Peck</p>
                                                <div className="icons">
                                                    <div className="icon rew">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
                                                            <path d="M5 32l32-22v13.8L57 10v44L37 40.2V54L5 32z"></path>
                                                        </svg>
                                                    </div>
                                                    <div className="icon play">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
                                                            <path d="M6 2l52 30L6 62V2z">
                                                            </path>
                                                        </svg>
                                                    </div>
                                                    <div className="icon nex">
                                                        {/* <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" style="transform: rotate(180deg);">
                                                            <path d="M5 32l32-22v13.8L57 10v44L37 40.2V54L5 32z"></path>
                                                        </svg> */}
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" style={svgStyle2}>
            <path d="M5 32l32-22v13.8L57 10v44L37 40.2V54L5 32z"></path>
        </svg>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="displayOptions iconWrapper-wX2">
                                                <div className="actionIcon iconItem lockOrientacion">
                                                    <div className="lockIcon"></div>
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
                                                        <path d="M53.832 34.947a26.016 26.016 0 1 0-7.45 15.432"></path>
                                                        <path d="M62 23l-8.168 11.947L43.014 25"></path>
                                                    </svg>
                                                </div>
                                                <div className="actionIcon iconItem moon">
                                                    {/* <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" style="transform: rotate(90deg);">
                                                        <path d="M35 2a25 25 0 0 1-22 36.8 24.9 24.9 0 0 1-10.6-2.3A30 30 0 1 0 35 2z"></path>
                                                    </svg> */}
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" style={svgStyle3}>
            <path d="M35 2a25 25 0 0 1-22 36.8 24.9 24.9 0 0 1-10.6-2.3A30 30 0 1 0 35 2z"></path>
        </svg>
                                                </div>
                                                <div className="iconItem duplicate full">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
                                                        <path d="M20 26V8h42v32H44"></path>
                                                        <path d="M2 26h42v32H2z"></path>
                                                    </svg>
                                                    <p>Duplicar pantalla</p>
                                                </div>
                                            </div>
                                            <div className="fullBars iconWrapper-wX2">
                                                <div className="iconItem fullBar brillo">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
                                                        <circle className="filled" cx="32" cy="32" r="14"></circle>
                                                        <path d="M32 2v8m0 44v8m30-30h-8m-44 0H2m8.8-21.2l5.6 5.6m31.2 31.2l5.6 5.6m0-42.4l-5.6 5.6M16.4 47.6l-5.6 5.6"></path>
                                                    </svg>
                                                </div>
                                                <div className="iconItem fullBar volumen">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
                                                        <path d="M44.2 21.8a12 12 0 0 1 0 20.5M50 16a20 20 0 0 1 0 32"></path>
                                                        <path className="filled" d="M38 6L20 24H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12l18 18z"></path>
                                                    </svg>
                                                </div>
                                            </div>
                                            <div className="textGroup">
                                                <div className="icono">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
                                                        <path d="M54 22.6V8h-9v7.445M40 62h14V29.769M10 30v32h14"></path>
                                                        <circle cx="32" cy="29" r="5"></circle>
                                                        <path d="M24 42h16v20H24zm8-37L2.436 28.651a.5.5 0 0 0-.036.749l3.287 3.287a.5.5 0 0 0 .668.035L32 12l25.65 20.718a.5.5 0 0 0 .668-.035l3.287-3.283a.5.5 0 0 0-.041-.744z"></path>
                                                    </svg>
                                                </div>
                                                <p>Aquí se mostrarán los accesorios y ambientaciones que agregues a la app Casa.</p>
                                                <p className="link">Abrir app Casa</p>
                                            </div>
                                            <div className="actionIcon iconItem lampara">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
                                                    <path className="filled" d="M117,62.85v13.72c0,32.45,10.64,61.49,27.43,81.57v206.43h109.71V158.14c16.79-20.08,27.43-49.12,27.43-81.57 V62.85H117z M203.37,246.86c0,6.45-10,6.43-10,0v-41.88c0-6.45,10-6.43,10,0V246.86z M259.35,73.33H136.65c-6.45,0-6.43-10,0-10 h122.69C265.79,63.33,265.78,73.33,259.35,73.33z"></path>
                                                    <path className="filled" d="M144.43,364.57v13.71c0,7.57,6.14,13.72,13.71,13.72h82.29c7.57,0,13.71-6.15,13.71-13.72v-13.71H144.43z M144.43,364.57"></path>
                                                    <path className="filled" d="M267.86,8H130.71C123.14,8,117,14.14,117,21.71v41.14h164.57V21.71C281.57,14.14,275.43,8,267.86,8L267.86,8z M267.86,8"></path>
                                                    <path d="M267.86,8h-68.57v54.85h-82.07v13.72h164.35V21.71C281.57,14.14,275.43,8,267.86,8z M259.35,73.33H136.65 c-6.45,0-6.43-10,0-10h122.69C265.79,63.33,265.78,73.33,259.35,73.33z"></path>
                                                    <path d="M199.29,364.57v13.71h-54.86c0,7.57,6.14,13.72,13.71,13.72h82.29c7.57,0,13.71-6.15,13.71-13.72v-13.71 H199.29z M199.29,364.57"></path>
                                                    <path d="M257.68,153.45c5.97-8.05,11-17.29,14.9-27.46C268.35,136.16,263.34,145.37,257.68,153.45L257.68,153.45z M257.68,153.45"></path>
                                                    <path d="M199.29,158.85c-15.13,0-27.43,12.29-27.43,27.43c0,13.11,9.22,24.07,21.51,26.78v-8.09c0-6.45,10-6.43,10,0 v8.43c13.2-1.98,23.35-13.37,23.35-27.13C226.72,171.15,214.41,158.85,199.29,158.85z"></path>
                                                    <path d="M218.68,166.9l-9.7,9.69c-2.48-2.48-5.91-4.02-9.7-4.02c-7.55,0-13.72,6.14-13.72,13.71 c0,3.79,1.54,7.22,4.02,9.7l-9.7,9.7c3.84,3.84,8.53,6.29,13.47,7.37v-8.07c0-6.45,10-6.43,10,0v8.41 c5.61-0.84,11-3.41,15.31-7.72C229.39,194.98,229.38,177.58,218.68,166.9z"></path>
                                                </svg>
                                            </div>
                                            <div className="actionIcon iconItem">
                                                <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                                                    <path className="filled" d="M29.375 35.625L16.293 18.707a1.007 1.007 0 0 1 1.414-1.414l16.918 13.082A3.739 3.739 0 0 1 30 36.254a3.914 3.914 0 0 1-.625-.629z"></path>
                                                    <path d="M10.787 10.787A30 30 0 1 0 32 2v13"></path>
                                                </svg>
                                            </div>
                                            <div className="actionIcon iconItem">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
                                                    <rect x="10" y="2" width="44" height="60" rx="2" ry="2"></rect>
                                                    <circle cx="21.5" cy="53.5" r="1.5"></circle>
                                                    <circle cx="32" cy="53.5" r="1.5"></circle>
                                                    <circle cx="42.5" cy="53.5" r="1.5"></circle>
                                                    <circle cx="21.5" cy="42.5" r="1.5"></circle>
                                                    <circle cx="32" cy="42.5" r="1.5"></circle>
                                                    <circle cx="42.5" cy="42.5" r="1.5"></circle>
                                                    <circle cx="21.5" cy="31.5" r="1.5"></circle>
                                                    <circle cx="32" cy="31.5" r="1.5"></circle>
                                                    <circle cx="42.5" cy="31.5" r="1.5"></circle>
                                                    <path d="M16 8h32v14H16zm26 4v4"></path>
                                                </svg>
                                            </div>
                                            <div className="actionIcon iconItem">
                                                <svg xmlns="http://www.w3.org/2000/svg" x="0" y="0" viewBox="0 0 512 512">
                                                    <circle className="filled" cx="256" cy="296" r="81"></circle>
                                                    <path className="filled" d="m374.297 91-5.177-25.883c-2.794-13.974-15.166-24.117-29.417-24.117h-167.406c-14.25 0-26.623 10.143-29.417 24.117l-5.177 25.883z"></path>
                                                    <path className="filled" d="m467 121c-35.223 0-405.516 0-422 0-24.813 0-45 20.187-45 45v260c0 24.813 20.187 45 45 45h422c24.813 0 45-20.187 45-45v-260c0-24.813-20.187-45-45-45zm-339 94h-48c-8.284 0-15-6.716-15-15s6.716-15 15-15h48c8.284 0 15 6.716 15 15s-6.716 15-15 15zm128 192c-61.206 0-111-49.794-111-111s49.794-111 111-111 111 49.794 111 111-49.794 111-111 111z"></path>
                                                </svg>
                                            </div>
                                            <div className="actionIcon iconItem grabarPantalla">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
                                                    <circle cx="32" cy="32" r="30" ></circle>
                                                    <circle className="filled" cx="32" cy="32" r="15" ></circle>
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="hiddenCC"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="interactionInfo hidden">
                        <h1>iPhone 12. iOS 14</h1>
                        <p>Interfaz interactiva del <b>iPhone 12</b> con el nuevo <b>iOS 14.</b></p>
                        <p>Algunas funciones son interactivas, se agregaron eventos para simular los gestos touch de los celulares, por lo pronto solo funciona en PC.</p>
                        <p className="importante">La app de camara muestra su interfaz y muestra el nuevo led indicador de uso de camara y microfono.</p>
                        <div className="botones">
                            <div className="boton botonGirar" data-front="Ver parte trasera" data-back="Ver parte frontal"></div>
                            <div className="boton botonBloquear" data-front="Bloquear pantalla" data-back="Desbloquear pantalla"></div>
                        </div>
                        <p>Entre las principales caracteristicas presentadas son:</p>
                        <ul>
                            <li>Las horas mostradas son en tiempo real.</li>
                            <li>La fecha es la actual.</li>
                            <li>El widget del calendario tambien muestra la fecha actual.</li>
                            <li>Se agregaron las notificaciones de iOS</li>
                            <li>Se agrego una animación que muestra la notificación de bateria baja xD</li>
                            <li>Se pueden eliminar las apps (presionar una app o cualquier parte de la appScreen por 1 segundo)</li>
                            <li>Al presionar cualquier parte de la appScreen (que no sea una app) se pasara directo a la edicion de la pantalla de inicio</li>
                            <li>Al presionar una app directamente se muestra el menu de acciones</li>
                            <li>Se agrego la pantalla para añadir widgets. Aunque no funciona la parte de añadir xD si muestra la animación al mostrar la pantalla</li>
                            <li>Los drags de las pantallas si funcionan, la <b>appScreen</b> tiene activado el drag a la izquierda y derecha, la <b>adminBar</b> el drag hacia abajo para mostrar el controlCenter, la <b>lockScreen</b> el drag hacia arriba para desbloquear el dispositivo</li>
                        </ul>
                    </div>
                </div>
            </section>
        </>
    )
}

export default Iphone;

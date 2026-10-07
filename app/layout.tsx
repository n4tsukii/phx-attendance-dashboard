import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'PHX · Phân tích dữ liệu điểm danh',description:'Trực quan hóa phân bố, chất lượng dữ liệu, grain và đối soát nguồn/raw của dữ liệu điểm danh học sinh.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body>{children}</body></html>;}

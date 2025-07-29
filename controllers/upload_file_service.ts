import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import FtpClient from "ftp";
import { promisify } from "util";

// Configuración FTP para GoDaddy
const ftpConfig = {
  host: process.env.GODADDY_FTP_HOST || 'muysaludable.com.mx',
  user: process.env.GODADDY_FTP_USER || 'uploads@muysaludable.com.mx',
  password: process.env.GODADDY_FTP_PASSWORD || '0ljOmLDWety3',
  port: 21,
  secure: false, // true para FTPS
  secureOptions: { rejectUnauthorized: false }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|avi|mov|wmv|flv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
}).array('files', 10);

// Función helper para FTP
const uploadToFTP = (buffer: Buffer, fileName: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const ftp = new FtpClient();
    
    ftp.on('ready', () => {
      // Cambiar al directorio de uploads
      ftp.cwd('/', (err) => {
        if (err) {
          console.log('Directorio no existe, creándolo...');
          // Si no existe, crear el directorio
          ftp.mkdir('/public_html/uploads/', true, (mkdirErr) => {
            if (mkdirErr) {
              ftp.end();
              return reject(mkdirErr);
            }
            uploadFile();
          });
        } else {
          uploadFile();
        }
      });

      function uploadFile() {
        ftp.put(buffer, fileName, (putErr) => {
          ftp.end();
          if (putErr) {
            reject(putErr);
          } else {
            resolve();
          }
        });
      }
    });

    ftp.on('error', (err) => {
      reject(err);
    });

    ftp.connect(ftpConfig);
  });
};


export const UploadFile = async (req: Request, res: Response) => {
    console.log( "FTPCONFIG" );
    console.log( ftpConfig );
    try {
        upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({
            success: false,
            message: `Error al procesar archivos: ${err.message}`
            });
        }

        const files = req.files as Express.Multer.File[];
        
        if (!files || files.length === 0) {
            return res.status(400).json({
            success: false,
            message: 'No se enviaron archivos'
            });
        }

        let publicUrl = process.env.GODADDY_PUBLIC_URL || 'http://muysaludable.com.mx/uploads/';
        publicUrl = publicUrl.replace(/^http:\/\//i, 'https://');
        
        const uploadedFiles: Array<{
            originalName: string;
            fileName: string;
            publicUrl: string;
            size: number;
            type: string;
        }> = [];

        // Procesar cada archivo
        for (const file of files) {
            try {
            // Generar nombre único
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(2, 8);
            const fileExtension = path.extname(file.originalname);
            const fileName = `${timestamp}_${randomString}${fileExtension}`;
            
            // Subir archivo via FTP
            await uploadToFTP(file.buffer, fileName);
            
            uploadedFiles.push({
                originalName: file.originalname,
                fileName: fileName,
                publicUrl: `${publicUrl}${fileName}`,
                size: file.size,
                type: file.mimetype
            });
            
            } catch (fileError) {
            console.error(`Error al subir archivo ${file.originalname}:`, fileError);
            }
        }

        if (uploadedFiles.length === 0) {
            return res.status(500).json({
            success: false,
            message: 'No se pudo subir ningún archivo'
            });
        }

        res.status(200).json({
            success: true,
            message: `Se subieron ${uploadedFiles.length} archivo(s) correctamente`,
            files: uploadedFiles,
            totalFiles: uploadedFiles.length
        });
        });
    } catch (error) {
        console.error('Error en UploadFile:', error);
        res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
        });
    }

}
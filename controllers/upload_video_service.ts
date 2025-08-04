// controllers/upload_video_service.ts
import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import { Storage } from "@google-cloud/storage";
// import { VideoUpload } from "../models/VideoUpload"; // Descomenta si usas Sequelize

// Configuración de Google Cloud Storage
// Detecta automáticamente si está en Cloud Run o local
const storageConfig: any = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
};

// Solo usa keyFilename si existe (desarrollo local)
if (process.env.GOOGLE_CLOUD_KEYFILE) {
  storageConfig.keyFilename = process.env.GOOGLE_CLOUD_KEYFILE;
}

const storage = new Storage(storageConfig);

const bucketName = process.env.GOOGLE_CLOUD_BUCKET || 'bucket_videos_muy_saludable';
const bucket = storage.bucket(bucketName);

// Configuración de Multer para videos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB límite
  },
  fileFilter: (req, file, cb) => {
    // Solo acepta archivos MP4
    const allowedTypes = /mp4/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = file.mimetype === 'video/mp4';
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos MP4'));
    }
  }
}).single('video'); // Un solo video por request

// Función helper para generar nombre de archivo con convención recomendada
const generateFileName = (originalName: string): string => {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_');
  const randomString = Math.random().toString(36).substring(2, 8);
  const sanitizedName = originalName
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Reemplaza caracteres especiales
    .toLowerCase();
  
  // Convención: YYYYMMDD_HHMMSS_random_originalname.mp4
  return `${timestamp}_${randomString}_${sanitizedName}`;
};

// Función helper para subir a Google Cloud Storage
const uploadToGCS = async (buffer: Buffer, fileName: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const file = bucket.file(fileName);
    
    const stream = file.createWriteStream({
      metadata: {
        contentType: 'video/mp4',
        // Cache por 1 año
        cacheControl: 'public, max-age=31536000',
      },
      resumable: true, // Para archivos grandes
      validation: 'crc32c', // Validación de integridad
    });

    stream.on('error', (err) => {
      console.error('Error al subir a GCS:', err);
      reject(err);
    });

    stream.on('finish', async () => {
      try {
        // Si el bucket tiene Uniform Bucket-Level Access, no usar makePublic()
        // En su lugar, generar URL pública directamente
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
        
        // Verificar que el archivo se subió correctamente
        const [exists] = await file.exists();
        if (!exists) {
          throw new Error('El archivo no se subió correctamente');
        }
        
        resolve(publicUrl);
      } catch (err) {
        reject(err);
      }
    });

    stream.end(buffer);
  });
};

// Función principal para subir video
export const UploadVideo = async (req: Request, res: Response) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: `Error al procesar video: ${err.message}`
        });
      }

      const file = req.file as Express.Multer.File;
      
      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'No se envió ningún video'
        });
      }

      try {
        console.log(`Iniciando subida de video: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        
        // Generar nombre único para el archivo
        const fileName = generateFileName(file.originalname);
        
        // Subir a Google Cloud Storage
        const publicUrl = await uploadToGCS(file.buffer, fileName);
        
        // Guardar en base de datos (descomenta si usas Sequelize)
        /*
        const videoRecord = await VideoUpload.create({
          filename: fileName,
          original_name: file.originalname,
          public_url: publicUrl,
          file_size: file.size
        });
        */
        
        // Si no usas Sequelize, puedes usar una consulta SQL directa
        // Ejemplo con mysql2 o similar:
        // await db.query(
        //   'INSERT INTO video_uploads (filename, original_name, public_url, file_size) VALUES (?, ?, ?, ?)',
        //   [fileName, file.originalname, publicUrl, file.size]
        // );
        
        console.log(`Video subido exitosamente: ${publicUrl}`);
        
        res.status(200).json({
          success: true,
          message: 'Video subido correctamente',
          data: {
            originalName: file.originalname,
            fileName: fileName,
            publicUrl: publicUrl,
            size: file.size,
            sizeFormatted: `${(file.size / 1024 / 1024).toFixed(2)} MB`
          }
        });
        
      } catch (uploadError) {
        console.error('Error al subir video:', uploadError);
        res.status(500).json({
          success: false,
          message: 'Error al subir el video a Google Cloud Storage'
        });
      }
    });
    
  } catch (error) {
    console.error('Error en UploadVideo:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Función adicional para obtener lista de videos subidos
export const getUploadedVideos = async (req: Request, res: Response) => {
  try {
    // Si usas Sequelize:
    /*
    const videos = await VideoUpload.findAll({
      order: [['created_at', 'DESC']]
    });
    */
    
    // Si usas consulta SQL directa:
    // const videos = await db.query('SELECT * FROM video_uploads ORDER BY created_at DESC');
    
    res.json({
      success: true,
      // videos: videos
    });
  } catch (error) {
    console.error('Error al obtener videos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la lista de videos'
    });
  }
};

// Función para eliminar video (opcional)
export const deleteVideo = async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        message: 'Nombre de archivo requerido'
      });
    }
    
    // Eliminar de Google Cloud Storage
    const file = bucket.file(filename);
    await file.delete();
    
    // Eliminar de base de datos
    /*
    await VideoUpload.destroy({
      where: { filename: filename }
    });
    */
    
    res.json({
      success: true,
      message: 'Video eliminado correctamente'
    });
    
  } catch (error) {
    console.error('Error al eliminar video:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar el video'
    });
  }
};
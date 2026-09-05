import { db } from "../db/database.js";

export const getRegistros = async (req, res) => {
  try {
    const { search, estado, prioridad } = req.query;
    const data = await db.getAll({ search, estado, prioridad });
    const stats = await db.getStats();

    res.json({
      success: true,
      count: data.length,
      stats,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error al obtener registros",
      error: error.message
    });
  }
};

export const getRegistroById = async (req, res) => {
  try {
    const { id } = req.params;
    const registro = await db.getById(id);

    if (!registro) {
      return res.status(404).json({
        success: false,
        message: `Registro con ID ${id} no encontrado`
      });
    }

    res.json({
      success: true,
      data: registro
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error al obtener el registro",
      error: error.message
    });
  }
};

export const createRegistro = async (req, res) => {
  try {
    const { paciente, tipoEstudio } = req.body;

    if (!paciente || !tipoEstudio) {
      return res.status(400).json({
        success: false,
        message: "El nombre del paciente y el tipo de estudio son obligatorios"
      });
    }

    const nuevo = await db.create(req.body);

    res.status(201).json({
      success: true,
      message: "Registro creado exitosamente",
      data: nuevo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error al crear el registro",
      error: error.message
    });
  }
};

export const updateRegistro = async (req, res) => {
  try {
    const { id } = req.params;
    const actualizado = await db.update(id, req.body);

    if (!actualizado) {
      return res.status(404).json({
        success: false,
        message: `Registro con ID ${id} no encontrado para actualizar`
      });
    }

    res.json({
      success: true,
      message: "Registro actualizado exitosamente",
      data: actualizado
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error al actualizar el registro",
      error: error.message
    });
  }
};

export const deleteRegistro = async (req, res) => {
  try {
    const { id } = req.params;
    const eliminado = await db.delete(id);

    if (!eliminado) {
      return res.status(404).json({
        success: false,
        message: `Registro con ID ${id} no encontrado para eliminar`
      });
    }

    res.json({
      success: true,
      message: `Registro ${id} eliminado exitosamente`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error al eliminar el registro",
      error: error.message
    });
  }
};

export const getStats = async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error al obtener estadísticas",
      error: error.message
    });
  }
};

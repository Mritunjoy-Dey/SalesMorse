import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API, timeout: 120000 });

export const api = {
  initSession: (sessionId, loadDemo = false) =>
    client
      .post(`/session/init?load_demo=${loadDemo}`, { session_id: sessionId })
      .then((r) => r.data),

  loadDemo: (sessionId) =>
    client.post(`/session/load-demo`, { session_id: sessionId }).then((r) => r.data),

  uploadFiles: (sessionId, files) => {
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    return client
      .post(`/upload?session_id=${encodeURIComponent(sessionId)}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  deleteFile: (sessionId, fileId) =>
    client.delete(`/file/${sessionId}/${fileId}`).then((r) => r.data),

  getFileContent: (sessionId, fileId) =>
    client.get(`/file/${sessionId}/${fileId}/content`).then((r) => r.data),

  downloadUrl: (sessionId, fileId) =>
    `${API}/file/${encodeURIComponent(sessionId)}/${encodeURIComponent(fileId)}/download`,

  generateBrief: (sessionId) =>
    client.post(`/brief/generate`, { session_id: sessionId }).then((r) => r.data),

  chat: (sessionId, question) =>
    client.post(`/chat`, { session_id: sessionId, question }).then((r) => r.data),

  feedback: (sessionId, vote, comment) =>
    client
      .post(`/feedback`, { session_id: sessionId, vote, comment })
      .then((r) => r.data),
};

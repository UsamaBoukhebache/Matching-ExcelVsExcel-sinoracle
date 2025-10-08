import { styles } from '../styles';

export function FileUploader({ inputRef, fileCount, onUpload, label }) {
  return (
    <div>
      <button 
        style={{...styles.button, backgroundColor: fileCount ? '#22c55e' : '#3b82f6'}}
        onClick={() => inputRef.current?.click()}
      >
        {fileCount ? `✓ ${label}` : `Subir ${label}`}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={onUpload}
      />
      {fileCount > 0 && (
        <div style={styles.info}>Productos cargados: <b>{fileCount}</b></div>
      )}
    </div>
  );
}
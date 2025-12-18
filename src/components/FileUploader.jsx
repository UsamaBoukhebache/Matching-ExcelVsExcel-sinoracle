import { styles } from '../styles';

export function FileUploader({ inputRef, fileCount, onUpload, label, disabled = false }) {
  return (
    <div>
      <button 
        style={{
          ...styles.button, 
          backgroundColor: disabled ? '#9ca3af' : (fileCount ? '#22c55e' : '#3b82f6'),
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        disabled={disabled}
        title={disabled ? 'Esperando autenticación...' : ''}
      >
        {disabled ? '⏳ Esperando...' : (fileCount ? `✓ ${label}` : `Subir ${label}`)}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={onUpload}
        disabled={disabled}
      />
      {fileCount > 0 && (
        <div style={styles.info}>Productos cargados: <b>{fileCount}</b></div>
      )}
    </div>
  );
}
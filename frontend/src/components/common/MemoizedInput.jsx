import React, { useCallback } from 'react';

// Мемоизированный компонент для инпута
export const MemoizedInput = React.memo(({
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
  className,
  id,
  name,
  accept,
  hasError = false,
  ...props
}) => {
  const handleChange = useCallback((e) => {
    onChange(e);
  }, [onChange]);

  const inputClassName = `${className} ${hasError ? 'border-red-400 bg-red-50' : ''}`;

  return (
    <input
      type={type}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      className={inputClassName}
      id={id}
      name={name}
      accept={accept}
      {...props}
    />
  );
});
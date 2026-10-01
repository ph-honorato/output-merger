import styled from "styled-components";

export const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 1rem;
  background-color: ${(props) =>
    props.theme === "dark" ? "#1a1a1a" : "#ffffff"};
  transition: background-color 0.3s ease;
`;

export const Button = styled.button`
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  background-color: #3b82f6;
  color: white;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #2563eb;
  }

  &:active {
    transform: scale(0.98);
  }
`;

export const CounterText = styled.div`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${(props) => (props.theme === "dark" ? "#ffffff" : "#000000")};
`;

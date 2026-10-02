import { Header } from './components';
import { Container } from '@mui/material';
import * as S from './App.styles';

function App() {
  return (
    <>
      <Header />
      <S.MainContainer>
        <Container maxWidth="xl">
          <S.PageContent>{/* Pages should be in here */}</S.PageContent>
        </Container>
      </S.MainContainer>
    </>
  );
}

export default App;
